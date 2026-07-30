import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
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

  await app.listen(process.env.PORT ?? 3001);
}

bootstrap();
