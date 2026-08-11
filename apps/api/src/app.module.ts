import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import redisConfig from './config/redis.config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { BusinessConfigModule } from './business-config/business-config.module';
import { AuditModule } from './audit/audit.module';
import { MenuModule } from './menu/menu.module';
import { TablesModule } from './tables/tables.module';
import { OrdersModule } from './orders/orders.module';
import { RealtimeModule } from './realtime/realtime.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PaymentsModule } from './payments/payments.module';
import { ShiftsModule } from './shifts/shifts.module';
import { DiscountsModule } from './discounts/discounts.module';
import { ReportsModule } from './reports/reports.module';
import { InventoryModule } from './inventory/inventory.module';
import { PublicModule } from './public/public.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';
import { RequestContextMiddleware } from './common/logging/request-context.middleware';
import { ShutdownLogger } from './common/logging/shutdown.logger';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // El .env vive en la raíz del monorepo, pero el CWD al arrancar es apps/api.
      // Sin esta ruta explícita nada del .env se cargaba y todo caía en los defaults.
      envFilePath: ['../../.env'],
      load: [appConfig, databaseConfig, jwtConfig, redisConfig],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => config.get('database')!,
    }),
    /**
     * Límite de peticiones, **sin guard global**.
     *
     * Se declara el módulo para que `AuthThrottlerGuard` tenga su almacén, y el guard se aplica
     * a mano solo en `AuthController`. Un `APP_GUARD` aquí estrangularía el local entero: todo
     * el tráfico de lectura sale de la IP del servidor de Next, `RealtimeRefresher` genera 12–18
     * peticiones por acción humana, y la ráfaga de reconexión de la cola sin conexión dispararía
     * el límite justo cuando lo que se está enviando son comandas.
     *
     * Almacén en memoria, que es el que trae por defecto: hay **un** servidor dentro del local.
     * Redis está declarado en `redis.config.ts` y nadie conecta a él; el día que haya varias
     * instancias, la pieza es `@nest-lab/throttler-storage-redis`, igual que el adaptador de
     * Socket.io. Coste asumido hasta entonces: los contadores se pierden al reiniciar el proceso.
     */
    ThrottlerModule.forRoot([{ name: 'sesion', ttl: 60_000, limit: 10 }]),
    AuthModule,
    UsersModule,
    RolesModule,
    BusinessConfigModule,
    AuditModule,
    MenuModule,
    TablesModule,
    OrdersModule,
    RealtimeModule,
    NotificationsModule,
    PaymentsModule,
    ShiftsModule,
    DiscountsModule,
    ReportsModule,
    InventoryModule,
    PublicModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    ShutdownLogger,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    // APP_INTERCEPTOR y no useGlobalInterceptors en main.ts, porque así el
    // interceptor puede recibir AuditService por inyección.
    { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor },
  ],
})
export class AppModule implements NestModule {
  /**
   * El middleware del id de petición se registra aquí, en el módulo, y no con `app.use()`
   * en `main.ts`. Motivo concreto: `createTestApp()` replica a mano los globales de
   * `main.ts` y no lo ejecuta, así que puesto allí tendría **cero cobertura** en los tests
   * de integración y solo se descubriría roto en producción.
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*splat');
  }
}
