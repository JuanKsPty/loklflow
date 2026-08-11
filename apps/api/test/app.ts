import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import type { JwtPayload } from '../src/common/interfaces/jwt-payload.interface';

/**
 * Arranca la aplicación real con **los mismos globales que `main.ts`**.
 *
 * Replicarlos no es opcional. Es el error habitual de las suites de Nest: sin el
 * `ValidationPipe` global los tests creen estar validando DTOs y no validan nada, así que
 * un endpoint que acepta basura pasaría la suite sin problema. Lo mismo con el prefijo
 * `/api` (todas las rutas quedarían en otro sitio), `cookieParser` (la estrategia JWT lee
 * el token de `req.cookies`, así que sin él toda petición autenticada daría 401), el
 * filtro de excepciones, que decide la forma del cuerpo de error que los tests comprueban, y
 * `helmet`, cuyas cabeceras comprueba `security.int-spec.ts` — que es también lo que hace que ese
 * spec valga algo: afirma sobre esta réplica, así que si alguien añade algo a `main.ts` y no aquí,
 * se ve.
 *
 * Se usa `init()` y no `listen()`: supertest trabaja contra `app.getHttpServer()` sin
 * necesidad de ocupar un puerto.
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

  const app = moduleRef.createNestApplication();
  // Mismo orden y mismas opciones que `main.ts`: helmet antes que nada, para que las cabeceras
  // lleguen incluso en una respuesta de error temprana.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      // El default de helmet es `sameorigin`. Esta API sirve JSON: meterla en un marco no tiene
      // ningún uso legítimo, así que `deny` es estrictamente mejor y no cuesta nada.
      frameguard: { action: 'deny' },
    }),
  );
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.init();
  return app;
}

/**
 * Cierra la app liberando la conexión a Postgres y el gateway de Socket.io.
 *
 * Sin esto Jest avisa de handles abiertos y el proceso no termina: el gateway mantiene un
 * servidor de websockets vivo aunque nunca se haya llamado a `listen()`.
 */
export async function closeTestApp(app: INestApplication | undefined): Promise<void> {
  if (app) await app.close();
}

export interface TokenOptions extends Partial<JwtPayload> {
  permissions?: string[];
}

/**
 * Cookie de sesión firmada con permisos a medida.
 *
 * Funciona sin tocar la base de datos porque `PermissionsGuard` lee los permisos **del
 * payload del token**, no de la BD. Eso permite comprobar cada endpoint con exactamente el
 * permiso que declara, en lugar de depender de qué rol del seed lo tenga hoy.
 *
 * Para lo que sí necesita un usuario real —los turnos de caja, o las notificaciones, que
 * tienen clave ajena a `users`— se pasa el id por `sub`.
 */
export function cookieFor(permissions: string[] = [], overrides: TokenOptions = {}): string {
  const jwt = new JwtService({ secret: process.env.JWT_SECRET });
  const payload: JwtPayload = {
    sub: '00000000-0000-4000-8000-000000000001',
    name: 'Tester',
    email: 'tester@loklflow.com',
    roleId: '00000000-0000-4000-8000-0000000000ff',
    roleName: 'Tester',
    permissions,
    loginMethod: 'email',
    ...overrides,
  };
  const token = jwt.sign(payload, { expiresIn: '15m' });
  return `access_token=${token}`;
}
