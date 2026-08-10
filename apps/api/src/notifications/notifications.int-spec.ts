import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { closeTestApp, createTestApp } from '../../test/app';
import { resetOperationalData } from '../../test/database';
import { seededUser, sessionAs } from '../../test/fixtures';
import { NotificationsService } from './notifications.service';

/**
 * Notificaciones.
 *
 * El caso que justifica el archivo es el IDOR: los endpoints **no llevan `@RequirePermissions`**
 * —cualquier empleado autenticado entra— y toda la autorización consiste en que cada consulta se
 * filtre por `user.sub`. Un `findOne({ where: { id } })` sin el `userId` convertiría esto en
 * «marca leída la notificación de tu jefe», y no habría guard que lo atrapara.
 */
describe('Notificaciones', () => {
  let app: INestApplication;
  let ds: DataSource;
  let service: NotificationsService;
  let mesero: string;
  let cajero: string;
  let meseroId: string;
  let cajeroId: string;

  beforeAll(async () => {
    app = await createTestApp();
    ds = app.get(DataSource);
    service = app.get(NotificationsService);
    // Sin permisos: son endpoints personales y así se comprueba de paso que no exigen ninguno.
    mesero = await sessionAs(app, 'mesero@loklflow.com', []);
    cajero = await sessionAs(app, 'cajero@loklflow.com', []);
    meseroId = (await seededUser(app, 'mesero@loklflow.com')).id;
    cajeroId = (await seededUser(app, 'cajero@loklflow.com')).id;
  });

  beforeEach(async () => {
    await resetOperationalData(ds);
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  const http = () => request(app.getHttpServer());

  async function notify(userId: string, title = 'Comanda lista') {
    await service.notifyUser(userId, { type: 'order_ready', title });
    const rows = await ds.query(
      `SELECT id FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [userId],
    );
    return rows[0].id as string;
  }

  it('cada uno ve solo las suyas', async () => {
    await notify(meseroId, 'Para el mesero');
    await notify(cajeroId, 'Para el cajero');

    const res = await http().get('/api/notifications').set('Cookie', mesero).expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Para el mesero');
  });

  it('el contador de no leídas es el propio', async () => {
    await notify(meseroId);
    await notify(meseroId);
    await notify(cajeroId);

    const res = await http()
      .get('/api/notifications/unread-count')
      .set('Cookie', mesero)
      .expect(200);
    expect(res.body).toEqual({ count: 2 });
  });

  /** El caso del archivo. */
  it('marcar leída la notificación de otro da 404, no 200', async () => {
    const ajena = await notify(cajeroId);

    await http()
      .patch(`/api/notifications/${ajena}/read`)
      .set('Cookie', mesero)
      .expect(404);

    // Y sigue sin leer: un 404 que igualmente escribiera sería peor que un 200 honesto.
    const rows = await ds.query(`SELECT is_read FROM notifications WHERE id = $1`, [ajena]);
    expect(rows[0].is_read).toBe(false);

    // Su dueño sí puede: el 404 de arriba es autorización, no una notificación rota.
    await http().patch(`/api/notifications/${ajena}/read`).set('Cookie', cajero).expect(200);
  });

  it('marcar la propia la deja leída y baja el contador', async () => {
    const mia = await notify(meseroId);

    const res = await http()
      .patch(`/api/notifications/${mia}/read`)
      .set('Cookie', mesero)
      .expect(200);
    expect(res.body.isRead).toBe(true);

    const contador = await http()
      .get('/api/notifications/unread-count')
      .set('Cookie', mesero)
      .expect(200);
    expect(contador.body).toEqual({ count: 0 });
  });

  it('«marcar todas» no toca las de nadie más', async () => {
    await notify(meseroId);
    await notify(meseroId);
    const ajena = await notify(cajeroId);

    const res = await http()
      .patch('/api/notifications/read-all')
      .set('Cookie', mesero)
      .expect(200);
    expect(res.body).toEqual({ count: 2 });

    const rows = await ds.query(`SELECT is_read FROM notifications WHERE id = $1`, [ajena]);
    expect(rows[0].is_read).toBe(false);
  });

  it('una que no existe da 404', async () => {
    await http()
      .patch('/api/notifications/00000000-0000-4000-8000-000000000999/read')
      .set('Cookie', mesero)
      .expect(404);
  });

  it('sin sesión no se leen', async () => {
    await http().get('/api/notifications').expect(401);
  });

  it('el listado viene de la más reciente a la más vieja y con tope', async () => {
    // La campana pinta las últimas; sin orden explícito el usuario vería las de anteayer arriba.
    for (let i = 0; i < 3; i++) await notify(meseroId, `Aviso ${i}`);

    const res = await http().get('/api/notifications').set('Cookie', mesero).expect(200);
    expect((res.body as { title: string }[]).map((n) => n.title)).toEqual([
      'Aviso 2',
      'Aviso 1',
      'Aviso 0',
    ]);
  });

  /**
   * `notifyUser` y `notifyRole` son best-effort a propósito: un fallo notificando no puede
   * tumbar el cambio de estado de una comanda, que es lo que las dispara.
   */
  it('notificar a un usuario que no existe no lanza', async () => {
    await expect(
      service.notifyUser('00000000-0000-4000-8000-000000000999', {
        type: 'order_ready',
        title: 'Al vacío',
      }),
    ).resolves.toBeUndefined();
  });

  it('el reparto por rol deja una fila por empleado activo del rol', async () => {
    await service.notifyRole('Mesero', { type: 'order_ready', title: 'Para todos los meseros' });

    const rows = await ds.query(
      `SELECT count(*)::int AS n FROM notifications WHERE title = 'Para todos los meseros'`,
    );
    const meseros = await ds.query(
      `SELECT count(*)::int AS n FROM users u JOIN roles r ON r.id = u.role_id
        WHERE r.name = 'Mesero' AND u.is_active = true`,
    );
    expect(rows[0].n).toBe(meseros[0].n);
  });
});
