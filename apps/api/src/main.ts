import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { createAppLogger } from './common/logging/app-logger';
import { REQUEST_ID_HEADER } from './common/logging/request-context.middleware';
import { installProcessHandlers } from './common/logging/process-handlers';
import { corsOrigins } from './config/cors';

async function bootstrap() {
  // El logger se pasa en las opciones, no con `app.useLogger()` después: así está puesto
  // **antes** de que Nest construya el contenedor, y un fallo de arranque —un secreto que
  // falta, la base que no responde— sale con el mismo formato que el resto en lugar de en
  // texto plano. `bufferLogs` ordena la salida y no arriesga nada: Nest vacía el búfer
  // tanto al escuchar como al abortar por un error de inicialización.
  const app = await NestFactory.create(AppModule, {
    logger: createAppLogger(),
    bufferLogs: true,
  });
  installProcessHandlers();

  /**
   * Cabeceras de seguridad.
   *
   * **Antes que CORS y que cualquier otra cosa**, para que las lleve incluso una respuesta de
   * error temprana.
   *
   * Dos opciones se apartan de los valores por defecto de helmet, y las dos por un motivo concreto
   * de este despliegue:
   *
   * - `contentSecurityPolicy: false`. Esta API sirve JSON; la única superficie HTML es Swagger UI,
   *   cuyo bootstrap va en un `<script>` en línea que el CSP por defecto de helmet
   *   (`default-src 'self'`, sin `unsafe-inline`) mata. Y Swagger ya está apagado en producción. El
   *   CSP que importa es el del front, que sí sirve HTML, y va en `next.config.ts`.
   * - `crossOriginResourcePolicy: 'cross-origin'`. El valor por defecto de helmet es `same-origin`,
   *   y **en desarrollo el web está en :3000 y la API en :3001**. Pegar los defaults rompería la
   *   aplicación entera en el entorno donde se trabaja todos los días. En producción todo va detrás
   *   del mismo dominio, así que ahí es inocuo.
   *
   * Se quedan tal cual `hsts`, `noSniff`, `referrerPolicy` y `hidePoweredBy` —que quita el
   * `X-Powered-By: Express` con el que la API anunciaba su pila a quien preguntara.
   */
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
  app.enableCors({
    origin: corsOrigins(),
    credentials: true,
    // Sin esto el navegador no deja leer la cabecera desde otro origen y el id de petición
    // que el servidor se molesta en devolver sería invisible para el cliente.
    exposedHeaders: [REQUEST_ID_HEADER],
  });
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  // Documentación en /api/docs. Fuera de producción a propósito: enumera toda la
  // superficie de la API y no hay motivo para publicarla en el servidor del negocio.
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('LoklFlow API')
      .setDescription(
        'Gestión operativa para establecimientos de alimentos y bebidas. ' +
          'La sesión va en la cookie httpOnly `access_token`; casi todos los ' +
          'endpoints exigen un permiso `módulo:acción`.',
      )
      .setVersion('0.1.0')
      .addCookieAuth('access_token')
      .addTag('auth', 'Sesión: login por email y por PIN, refresh y logout')
      .addTag('users', 'Empleados')
      .addTag('roles', 'Roles y permisos')
      .addTag('menu', 'Categorías, productos, modificadores y combos')
      .addTag('tables', 'Sectores, mesas y reservas')
      .addTag('orders', 'Órdenes, ítems y flujo de estados')
      .addTag('payments', 'Cobro, split y propina')
      .addTag('discounts', 'Descuentos con aprobación por rol')
      .addTag('shifts', 'Turnos de caja y arqueo')
      .addTag('reports', 'Métricas agregadas y exportación')
      .addTag('notifications', 'Avisos entre roles')
      .addTag('audit-logs', 'Bitácora de acciones críticas')
      .addTag('business-config', 'Configuración del negocio')
      .build();

    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config), {
      jsonDocumentUrl: 'api/docs-json',
    });
  }

  // Para que el apagado ordenado exista y quede registrado: sin esto un SIGTERM del
  // orquestador y un proceso que se murió sin decir nada se ven exactamente igual en el log.
  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 3001);
}

bootstrap();
