import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { TokenVersionCache } from './token-version.cache';

/**
 * Módulo propio y no una pieza de `AuthModule`, por una razón mecánica: lo necesitan **tres**
 * módulos —auth para firmar y verificar, users para subir la versión al desactivar o cambiar de
 * rol, y roles para subirla al cambiar permisos—, y esos tres ya se importan entre sí. Dejarlo en
 * cualquiera de ellos crearía un ciclo.
 *
 * Solo necesita el repositorio de usuarios, así que el módulo es de tres líneas y no arrastra nada.
 */
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [TokenVersionCache],
  exports: [TokenVersionCache],
})
export class TokenVersionModule {}
