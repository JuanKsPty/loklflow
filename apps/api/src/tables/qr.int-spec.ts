import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { closeTestApp, createTestApp } from '../../test/app';
import { firstTable, sessionAs } from '../../test/fixtures';

/**
 * El token de QR de una mesa.
 *
 * La columna existía desde el esquema inicial y se rellenaba con `randomUUID()`, pero no había
 * forma de cambiarla: un token filtrado —una foto de la hoja en redes, una hoja que se cambia de
 * mesa— valía para siempre y no se podía revocar.
 */
describe('QR de mesa', () => {
  let app: INestApplication;
  let cookie: string;
  let table: { id: string; number: number };

  beforeAll(async () => {
    app = await createTestApp();
    cookie = await sessionAs(app, 'admin@loklflow.com', ['tables:read', 'tables:update']);
    table = await firstTable(app);
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  const http = () => request(app.getHttpServer());
  const rotate = (id: string, as = cookie) =>
    http().post(`/api/tables/${id}/qr/rotate`).set('Cookie', as);
  const read = async (id: string) =>
    (await http().get(`/api/tables/${id}`).set('Cookie', cookie).expect(200)).body as {
      qrCode: string;
    };

  it('cambia el token e invalida el anterior', async () => {
    const before = (await read(table.id)).qrCode;

    const res = await rotate(table.id).expect(201);

    expect(res.body.qrCode).not.toBe(before);
    expect(await read(table.id)).toMatchObject({ qrCode: res.body.qrCode });
  });

  it('cada rotación da un token distinto', async () => {
    const uno = (await rotate(table.id).expect(201)).body.qrCode as string;
    const dos = (await rotate(table.id).expect(201)).body.qrCode as string;

    expect(uno).not.toBe(dos);
  });

  it('la ruta no la captura el comodín de :id', async () => {
    // `@Patch(':id')` está declarado en el mismo controlador; si la ruta literal se declarara
    // después, esta petición acabaría intentando actualizar una mesa con id «qr».
    await rotate(table.id).expect(201);
  });

  it('exige tables:update', async () => {
    const soloLectura = await sessionAs(app, 'mesero@loklflow.com', ['tables:read']);

    await rotate(table.id, soloLectura).expect(403);
  });

  it('una mesa que no existe da 404, no 500', async () => {
    await rotate('00000000-0000-4000-8000-000000000999').expect(404);
  });

  /**
   * `qrCode` no está en `CreateTableDto`, y `UpdateTableDto` es un `PartialType` de esa clase.
   * Declararlo permitiría a cualquiera con `tables:update` **escoger** el token de una mesa, y
   * por tanto ponerle el de otra. `forbidNonWhitelisted` lo rechaza.
   */
  it('nadie puede escoger el token de una mesa', async () => {
    await http()
      .patch(`/api/tables/${table.id}`)
      .set('Cookie', cookie)
      .send({ qrCode: 'el-que-yo-elija' })
      .expect(400);
  });

  it('deja rastro en la bitácora, porque invalida material impreso', async () => {
    const auditor = await sessionAs(app, 'admin@loklflow.com', ['tables:update', 'audit:read']);
    await http().post(`/api/tables/${table.id}/qr/rotate`).set('Cookie', auditor).expect(201);

    const res = await http()
      .get('/api/audit-logs?action=table.qr_rotated')
      .set('Cookie', auditor)
      .expect(200);

    // Se busca la fila, no se asume que sea la primera: esta suite no llama a
    // `resetOperationalData`, así que la bitácora puede traer lo que dejaron otras suites, y una
    // aserción por índice sería un fallo intermitente que aparece según el orden de ejecución.
    const rows = res.body.data as { action: string; entityType: string; entityId: string }[];
    expect(
      rows.some(
        (r) =>
          r.action === 'table.qr_rotated' &&
          r.entityType === 'table' &&
          r.entityId === table.id,
      ),
    ).toBe(true);
  });
});
