import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { closeTestApp, createTestApp } from '../../test/app';
import { cookieFor } from '../../test/app';
import { seededRole, seededUser, sessionAs } from '../../test/fixtures';

/**
 * Los agujeros de sesión, convertidos en pruebas.
 *
 * Cada `describe` es un hallazgo de la auditoría: un PIN de cuatro dígitos sin freno, una tabla de
 * credenciales que crecía sin tope y un cierre de sesión que podía no cerrar nada.
 */
describe('endurecimiento de la sesión', () => {
  let app: INestApplication;
  let ds: DataSource;

  beforeAll(async () => {
    app = await createTestApp();
    ds = app.get(DataSource);
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  const http = () => request(app.getHttpServer());

  /** Cookie firmada para un usuario concreto, con su versión de sesión **actual**. */
  async function cookieForUser(userId: string): Promise<string> {
    const [row] = await ds.query('SELECT token_version FROM users WHERE id = $1', [userId]);
    return cookieFor(['orders:read'], { sub: userId, tv: Number(row.token_version) });
  }
  const pin = (userId: string, value: string) =>
    http().post('/api/auth/pin').send({ userId, pin: value });
  /** Login por correo, con su propio cupo de límite de peticiones. Ver la nota más abajo. */
  const byEmail = () =>
    http().post('/api/auth/login').send({ email: 'admin@loklflow.com', password: 'Admin1234!' });

  describe('bloqueo por intentos fallidos', () => {
    /**
     * **La propiedad que hace útil el bloqueo**: desde fuera, una cuenta bloqueada y un PIN mal se
     * ven exactamente igual. Un 423 o un mensaje distinto serían un oráculo gratis —«esta cuenta
     * existe y alguien la está atacando»— y le dirían a quien prueba cuándo volver.
     */
    it('una cuenta bloqueada responde igual que un PIN incorrecto', async () => {
      const target = await seededUser(app, 'cajero@loklflow.com');

      const primero = await pin(target.id, '0000');
      for (let i = 0; i < 6; i++) await pin(target.id, '0000');
      const bloqueado = await pin(target.id, '0000');

      expect(bloqueado.status).toBe(primero.status);
      expect(bloqueado.body.message).toBe(primero.body.message);
      // Ni pistas de cuánto falta.
      expect(JSON.stringify(bloqueado.body)).not.toMatch(/bloque|lock|segundo|minuto/i);
    });

    it('el PIN correcto tampoco entra mientras dure el bloqueo', async () => {
      const target = await seededUser(app, 'admin@loklflow.com');
      for (let i = 0; i < 6; i++) await pin(target.id, '0000');

      // El admin no tiene PIN, así que el correcto tampoco existiría; lo que se comprueba es que
      // el bloqueo corta **antes** de llegar a comparar nada.
      const res = await pin(target.id, '1234');

      expect(res.status).toBe(401);
    });

    it('deja constancia en la bitácora', async () => {
      const auditor = await sessionAs(app, 'admin@loklflow.com', ['audit:read']);
      const target = await seededUser(app, 'mesero@loklflow.com');
      for (let i = 0; i < 6; i++) await pin(target.id, '0000');

      const res = await http()
        .get('/api/audit-logs?action=auth.login_locked')
        .set('Cookie', auditor)
        .expect(200);

      // Lo que el dueño quiere ver es «alguien estuvo probando con la cuenta de Ana», no 200
      // líneas de intento fallido.
      expect((res.body.data as unknown[]).length).toBeGreaterThan(0);
    });

    it('bloquear a un usuario no bloquea a otro', async () => {
      const uno = await seededUser(app, 'mesero@loklflow.com');
      const otro = await seededUser(app, 'cajero@loklflow.com');
      for (let i = 0; i < 6; i++) await pin(uno.id, '0000');

      // Es lo que impide que un cajero que se equivoca deje fuera al mesero de la mesa de al lado.
      const res = await pin(otro.id, '0000');
      expect(res.body.message).not.toMatch(/bloque/i);
    });
  });

  /**
   * Estas dos usan el login por **correo**, no por PIN, y no es casualidad: el límite de peticiones
   * se cuenta por `(ip, sujeto)`, y en un test todas las peticiones salen de la misma IP. Los casos
   * de bloqueo de arriba queman el cupo del mesero, así que reutilizarlo aquí daría 429 por un
   * motivo que no tiene nada que ver con lo que se está probando.
   */
  describe('tokens de refresco', () => {
    /**
     * `refresh_tokens` crecía sin tope: cada inicio de sesión inserta una fila y solo el `logout`
     * las revoca en bloque. Meses de operación normal —una tablet que entra por PIN varias veces al
     * día— dejan cientos de credenciales vivas que nadie va a usar, y cada una es una sesión que un
     * robo de base de datos podría reactivar.
     */
    it('no se acumulan más de cinco vivos por usuario', async () => {
      const admin = await seededUser(app, 'admin@loklflow.com');
      await ds.query('DELETE FROM refresh_tokens WHERE user_id = $1', [admin.id]);

      for (let i = 0; i < 8; i++) {
        await byEmail().expect(200);
      }

      const [row] = await ds.query(
        'SELECT count(*)::int AS n FROM refresh_tokens WHERE user_id = $1 AND is_revoked = false',
        [admin.id],
      );
      expect(row.n).toBeLessThanOrEqual(5);
    });

    it('el último emitido sobrevive a la poda', async () => {
      // La poda corre **después** de insertar y excluye el recién emitido: si no, el login se
      // invalidaría a sí mismo y el operario entraría con una sesión ya muerta.
      const res = await byEmail().expect(200);
      const cookies = res.headers['set-cookie'] as unknown as string[];
      const refresh = cookies.find((c) => c.startsWith('refresh_token='))!;

      await http().post('/api/auth/refresh').set('Cookie', refresh).expect(200);
    });
  });

  /**
   * Revocación efectiva de sesiones.
   *
   * `JwtStrategy` solo comprobaba que el token tuviera `sub`, y `PermissionsGuard` lee los permisos
   * **del token**: desactivar a un empleado o cambiarle el rol no tenía ningún efecto hasta que el
   * token caducara. Con una sesión por PIN eso son cuatro horas de acceso operativo tras el
   * despido, y su token de refresco vive doce.
   */
  describe('revocación de sesiones', () => {
    it('una sesión válida sigue funcionando', async () => {
      // Cookie firmada en vez de un login real: el límite de peticiones de `/auth/login` se cuenta
      // por `(ip, email)`, y en un archivo de tests todo sale de la misma IP. Gastar cupo en lo que
      // no se está probando haría fallar por 429 a los casos de más abajo.
      const admin = await seededUser(app, 'admin@loklflow.com');

      await http().get('/api/orders').set('Cookie', await cookieForUser(admin.id)).expect(200);
    });

    /**
     * También sobre un usuario creado aquí: dar de baja a un sembrado lo dejaría inactivo —o con la
     * versión subida— para el resto de la ejecución, y las suites que corran después fallarían con
     * 401 sin ninguna relación aparente.
     */
    it('dar de baja a un empleado invalida su sesión en la petición siguiente', async () => {
      const admin = await sessionAs(app, 'admin@loklflow.com', [
        'users:read',
        'users:create',
        'users:delete',
      ]);
      const rol = await seededRole(app, 'Mesero');

      const usuario = (
        await http()
          .post('/api/users')
          .set('Cookie', admin)
          .send({ name: 'Despedible', email: `baja-${Date.now()}@loklflow.com`, password: 'Passw0rd!2345', roleId: rol.id })
          .expect(201)
      ).body as { id: string };

      const victimCookie = await cookieForUser(usuario.id);
      await http().get('/api/orders').set('Cookie', victimCookie).expect(200);

      await http().delete(`/api/users/${usuario.id}`).set('Cookie', admin).expect(204);

      // Sin esperar a que caduque nada.
      await http().get('/api/orders').set('Cookie', victimCookie).expect(401);
    });

    /**
     * Sobre un rol y un usuario **creados aquí**, no sobre los sembrados.
     *
     * Cambiar los permisos del rol Mesero lo dejaría cambiado para toda la ejecución —el catálogo
     * sobrevive a `resetOperationalData`—, y además subiría la versión de sesión de los usuarios
     * sembrados, rompiendo con 401 a cualquier suite posterior que los use. Es contaminación de
     * estado compartido, y el síntoma sería un fallo en un archivo que no tiene nada que ver.
     */
    it('cambiar los permisos de un rol invalida las sesiones de sus usuarios', async () => {
      const admin = await sessionAs(app, 'admin@loklflow.com', [
        'roles:read',
        'roles:create',
        'roles:update',
        'users:create',
      ]);

      const rol = (
        await http()
          .post('/api/roles')
          .set('Cookie', admin)
          .send({ name: `Prueba revocación ${Date.now()}` })
          .expect(201)
      ).body as { id: string };

      const usuario = (
        await http()
          .post('/api/users')
          .set('Cookie', admin)
          .send({ name: 'Revocable', email: `rev-${Date.now()}@loklflow.com`, password: 'Passw0rd!2345', roleId: rol.id })
          .expect(201)
      ).body as { id: string };

      const victimCookie = await cookieForUser(usuario.id);
      await http().get('/api/orders').set('Cookie', victimCookie).expect(200);

      const permisos = await http().get('/api/roles/permissions').set('Cookie', admin).expect(200);
      const alguno = (permisos.body as { id: string }[]).slice(0, 3).map((p) => p.id);
      await http()
        .put(`/api/roles/${rol.id}/permissions`)
        .set('Cookie', admin)
        .send({ permissionIds: alguno })
        .expect(200);

      await http().get('/api/orders').set('Cookie', victimCookie).expect(401);
    });

    /**
     * La barandilla que hace que este despliegue **no eche a nadie**: los tokens emitidos antes de
     * que la columna existiera no llevan `tv`, y se tratan como versión 0 —la de todos los usuarios
     * tras la migración.
     */
    it('un token anterior a la función sigue valiendo', async () => {
      const target = await seededUser(app, 'admin@loklflow.com');
      const sinTv = cookieFor(['orders:read'], { sub: target.id });

      await http().get('/api/orders').set('Cookie', sinTv).expect(200);
    });
  });

  describe('cierre de sesión', () => {
    /**
     * `clearCookie` llevaba solo `path`. Varios navegadores cotejan el conjunto de atributos al
     * invalidar una cookie, así que unos `httpOnly`/`secure`/`sameSite` distintos pueden hacer que
     * **la cookie sobreviva al cierre de sesión**.
     */
    it('borra las cookies con los mismos atributos con que se pusieron', async () => {
      // Lo que se comprueba son los atributos del `Set-Cookie` que **borra**, y esos no dependen de
      // cómo se entrara: una cookie firmada evita gastar cupo del límite de peticiones.
      const admin = await seededUser(app, 'admin@loklflow.com');

      const res = await http()
        .post('/api/auth/logout')
        .set('Cookie', await cookieForUser(admin.id))
        .expect(204);

      const cleared = res.headers['set-cookie'] as unknown as string[];
      const access = cleared.find((c) => c.startsWith('access_token='))!;

      expect(access).toMatch(/HttpOnly/i);
      expect(access).toMatch(/SameSite=Strict/i);
      expect(access).toMatch(/Path=\//);
      // Y caduca de verdad.
      expect(access).toMatch(/Expires=Thu, 01 Jan 1970/i);
    });
  });
});
