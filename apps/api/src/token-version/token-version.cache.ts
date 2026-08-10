import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';

/**
 * La versión de sesión de cada usuario, con caché en proceso.
 *
 * **Por qué no se consulta la base en cada petición.** No sería «una consulta por petición»: sería
 * una consulta por petición **multiplicada por el refresco en tiempo real**, que recarga a todos
 * los clientes ante cada evento —una sola acción humana con seis pantallas abiertas son 12–18
 * peticiones—. Y los guards resuelven antes que cualquier interceptor, así que cae en el punto más
 * caliente sin forma de saltarlo para las lecturas.
 *
 * Con caché de 30 s y **invalidación directa por el escritor**, el régimen estacionario cuesta cero
 * consultas y la revocación es inmediata: hay un solo proceso, así que quien sube la versión puede
 * tirar la entrada él mismo. El TTL solo cubre cambios hechos por fuera —el seed, un `UPDATE` a
 * mano—, donde 30 s de retraso no le importan a nadie.
 */
const TTL_MS = 30_000;

interface Entry {
  version: number;
  readAt: number;
}

@Injectable()
export class TokenVersionCache {
  private readonly logger = new Logger(TokenVersionCache.name);
  private readonly cache = new Map<string, Entry>();

  constructor(@InjectRepository(User) private readonly usersRepo: Repository<User>) {}

  /**
   * La versión actual del usuario.
   *
   * **Falla en abierto.** Si la consulta falla se sirve el último valor cacheado y, si no lo hay,
   * se devuelve `null` para que quien llame acepte el token. Es una caja registradora: un parpadeo
   * de Postgres no puede echar al salón entero a mitad de servicio, y el riesgo que se acepta a
   * cambio —una sesión revocada que sobrevive los segundos que dure la caída— está escrito en
   * `docs/SECURITY.md`.
   */
  async versionOf(userId: string): Promise<number | null> {
    const cached = this.cache.get(userId);
    if (cached && Date.now() - cached.readAt < TTL_MS) return cached.version;

    try {
      const row = await this.usersRepo.findOne({
        where: { id: userId },
        select: { id: true, tokenVersion: true },
      });
      // Usuario que ya no existe: no hay versión con la que comparar y quien llama decide.
      if (!row) return null;

      this.cache.set(userId, { version: row.tokenVersion, readAt: Date.now() });
      return row.tokenVersion;
    } catch (err) {
      this.logger.warn({
        event: 'token-version:read-failed',
        userId,
        served: cached ? 'cache' : 'none',
        error: err instanceof Error ? err.message : String(err),
      });
      return cached?.version ?? null;
    }
  }

  /**
   * Sube la versión del usuario y tira su entrada.
   *
   * El `UPDATE` y la invalidación van juntos a propósito: separarlos dejaría una ventana de hasta
   * 30 s en la que la sesión revocada sigue valiendo, que es justo lo que esto viene a cerrar.
   */
  async bump(userId: string): Promise<void> {
    await this.usersRepo.increment({ id: userId }, 'tokenVersion', 1);
    this.cache.delete(userId);
  }

  /** Lo mismo para todos los usuarios de un rol: cambiar sus permisos invalida sus sesiones. */
  async bumpByRole(roleId: string): Promise<void> {
    const users = await this.usersRepo.find({ where: { role: { id: roleId } }, select: { id: true } });
    if (users.length === 0) return;
    await this.usersRepo
      .createQueryBuilder()
      .update(User)
      .set({ tokenVersion: () => '"token_version" + 1' })
      .where('role_id = :roleId', { roleId })
      .execute();
    for (const user of users) this.cache.delete(user.id);
  }

  /** Solo para los tests. */
  clear(): void {
    this.cache.clear();
  }
}
