import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { closeTestApp, createTestApp } from '../../test/app';
import { resetOperationalData } from '../../test/database';
import { sessionAs } from '../../test/fixtures';
import { RealtimeGateway } from '../realtime/realtime.gateway';

/**
 * Mesas, sectores y reservas.
 *
 * El módulo no tenía ni una prueba y es el que sostiene el plano del salón: tres servicios y
 * dieciséis endpoints. Lo que se comprueba aquí no es el CRUD por el CRUD, sino los tres sitios
 * donde el módulo puede responder un 500 o mentir: la numeración única, la mesa que no existe y
 * la reserva encima de otra.
 */
describe('Mesas, sectores y reservas', () => {
  let app: INestApplication;
  let ds: DataSource;
  let admin: string;
  /** Sectores creados por la suite, para borrarlos y no dejar catálogo de más. */
  const created: string[] = [];

  const UUID_INEXISTENTE = '00000000-0000-4000-8000-000000000999';

  beforeAll(async () => {
    app = await createTestApp();
    ds = app.get(DataSource);
    admin = await sessionAs(app, 'admin@loklflow.com', [
      'tables:create',
      'tables:read',
      'tables:update',
      'tables:delete',
    ]);
  });

  beforeEach(async () => {
    await resetOperationalData(ds);
  });

  afterAll(async () => {
    // `resetOperationalData` deja el catálogo intacto a propósito, así que las mesas y sectores
    // que crea esta suite se limpian aquí o contaminan a las demás: `nextNumber()` es global.
    if (created.length > 0) {
      await ds.query(`DELETE FROM "tables" WHERE sector_id = ANY($1::uuid[])`, [created]);
      await ds.query(`DELETE FROM "sectors" WHERE id = ANY($1::uuid[])`, [created]);
    }
    await closeTestApp(app);
  });

  const http = () => request(app.getHttpServer());

  let sectorSeq = 0;
  async function newSector(name = `Sector de prueba ${++sectorSeq}`) {
    const res = await http()
      .post('/api/tables/sectors')
      .set('Cookie', admin)
      .send({ name })
      .expect(201);
    created.push(res.body.id);
    return res.body as { id: string; name: string };
  }

  async function newTable(sectorId: string, body: Record<string, unknown> = {}) {
    const res = await http()
      .post('/api/tables')
      .set('Cookie', admin)
      .send({ sectorId, capacity: 4, ...body })
      .expect(201);
    return res.body as { id: string; number: number; qrCode: string };
  }

  describe('sectores', () => {
    it('se crean, se listan y se editan', async () => {
      const sector = await newSector('Terraza norte');

      const listado = await http().get('/api/tables/sectors').set('Cookie', admin).expect(200);
      expect((listado.body as { id: string }[]).some((s) => s.id === sector.id)).toBe(true);

      const editado = await http()
        .patch(`/api/tables/sectors/${sector.id}`)
        .set('Cookie', admin)
        .send({ name: 'Terraza sur' })
        .expect(200);
      expect(editado.body.name).toBe('Terraza sur');
    });

    it('uno que no existe da 404, no 500', async () => {
      await http()
        .get(`/api/tables/sectors/${UUID_INEXISTENTE}`)
        .set('Cookie', admin)
        .expect(404);
    });

    it('un id que no es uuid da 400 antes de tocar la base', async () => {
      await http().get('/api/tables/sectors/no-es-uuid').set('Cookie', admin).expect(400);
    });
  });

  describe('mesas', () => {
    it('sin número, toma el siguiente libre', async () => {
      const sector = await newSector();

      const a = await newTable(sector.id);
      const b = await newTable(sector.id, { capacity: 2 });

      expect(b.number).toBe(a.number + 1);
    });

    /**
     * El número es único **global**, no por sector. Un duplicado tiene que salir como 400 con un
     * mensaje legible, no como el 500 de una violación de unicidad — que es lo que pasaría sin
     * el `saveUnique` del servicio.
     */
    it('un número repetido da 400, no un 500 de la base', async () => {
      const sector = await newSector();
      const primera = await newTable(sector.id);

      const res = await http()
        .post('/api/tables')
        .set('Cookie', admin)
        .send({ sectorId: sector.id, capacity: 4, number: primera.number })
        .expect(400);

      expect(String(res.body.message)).toMatch(/mesa con el número/i);
    });

    it('cada mesa nace con su propio código QR y el cliente no puede elegirlo', async () => {
      const sector = await newSector();
      const a = await newTable(sector.id);
      const b = await newTable(sector.id);

      expect(a.qrCode).toBeTruthy();
      expect(a.qrCode).not.toBe(b.qrCode);

      // `qrCode` está fuera de `CreateTableDto` a propósito, y `forbidNonWhitelisted` lo
      // convierte en un 400: si alguien lo añadiera al DTO «por comodidad», esto se pone rojo.
      await http()
        .post('/api/tables')
        .set('Cookie', admin)
        .send({ sectorId: sector.id, capacity: 4, qrCode: a.qrCode })
        .expect(400);
    });

    it('la creación en lote numera sin colisionar al repetirla', async () => {
      const sector = await newSector();

      await http()
        .post('/api/tables/bulk')
        .set('Cookie', admin)
        .send({ sectorId: sector.id, count: 3, capacity: 4 })
        .expect(201);
      const res = await http()
        .post('/api/tables/bulk')
        .set('Cookie', admin)
        .send({ sectorId: sector.id, count: 3, capacity: 4 })
        .expect(201);

      // `createMany` devuelve el salón entero, no solo lo creado: la afirmación útil es que
      // ningún número se repite entre las mesas de este sector.
      const mias = (res.body as { number: number; sectorId: string }[]).filter(
        (t) => t.sectorId === sector.id,
      );
      expect(mias).toHaveLength(6);
      expect(new Set(mias.map((t) => t.number)).size).toBe(6);
    });

    it('el lote tiene tope', async () => {
      const sector = await newSector();
      await http()
        .post('/api/tables/bulk')
        .set('Cookie', admin)
        .send({ sectorId: sector.id, count: 500, capacity: 4 })
        .expect(400);
    });

    it('el layout guarda las posiciones', async () => {
      const sector = await newSector();
      const mesa = await newTable(sector.id);

      await http()
        .patch('/api/tables/layout')
        .set('Cookie', admin)
        .send({ positions: [{ id: mesa.id, positionX: 120, positionY: 340, shape: 'round' }] })
        .expect(200);

      const leida = await http().get(`/api/tables/${mesa.id}`).set('Cookie', admin).expect(200);
      expect(leida.body).toMatchObject({ positionX: 120, positionY: 340, shape: 'round' });
    });

    it('cambiar el estado emite el evento de tiempo real', async () => {
      const sector = await newSector();
      const mesa = await newTable(sector.id);

      // Sin evento, las pantallas del salón se quedan con el color viejo hasta que alguien
      // recargue. Es la mitad invisible de la funcionalidad, y por eso se afirma.
      const gateway = app.get(RealtimeGateway);
      const spy = jest.spyOn(gateway, 'emitTable').mockImplementation(() => undefined);

      await http()
        .patch(`/api/tables/${mesa.id}/status`)
        .set('Cookie', admin)
        .send({ status: 'cleaning' })
        .expect(200);

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ tableId: mesa.id, status: 'cleaning' }),
      );
      spy.mockRestore();
    });

    it('un estado que no existe se rechaza', async () => {
      const sector = await newSector();
      const mesa = await newTable(sector.id);

      await http()
        .patch(`/api/tables/${mesa.id}/status`)
        .set('Cookie', admin)
        .send({ status: 'inventado' })
        .expect(400);
    });

    it('rotar el QR invalida el anterior', async () => {
      const sector = await newSector();
      const mesa = await newTable(sector.id);

      const rotada = await http()
        .post(`/api/tables/${mesa.id}/qr/rotate`)
        .set('Cookie', admin)
        .expect(201);

      expect(rotada.body.qrCode).not.toBe(mesa.qrCode);
    });

    it('se borra', async () => {
      const sector = await newSector();
      const mesa = await newTable(sector.id);

      await http().delete(`/api/tables/${mesa.id}`).set('Cookie', admin).expect(204);
      await http().get(`/api/tables/${mesa.id}`).set('Cookie', admin).expect(404);
    });

    it('exige permiso para escribir', async () => {
      const soloLectura = await sessionAs(app, 'mesero@loklflow.com', ['tables:read']);
      const sector = await newSector();

      await http()
        .post('/api/tables')
        .set('Cookie', soloLectura)
        .send({ sectorId: sector.id, capacity: 4 })
        .expect(403);
    });
  });

  describe('reservas', () => {
    const enHoras = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

    it('se crean, se listan y se editan', async () => {
      const sector = await newSector();
      const mesa = await newTable(sector.id);

      const creada = await http()
        .post('/api/tables/reservations')
        .set('Cookie', admin)
        .send({ tableId: mesa.id, customerName: 'Ana', partySize: 4, reservedAt: enHoras(3) })
        .expect(201);

      const listado = await http()
        .get('/api/tables/reservations')
        .set('Cookie', admin)
        .expect(200);
      expect((listado.body as { id: string }[]).some((r) => r.id === creada.body.id)).toBe(true);

      const editada = await http()
        .patch(`/api/tables/reservations/${creada.body.id}`)
        .set('Cookie', admin)
        .send({ status: 'confirmed', partySize: 6 })
        .expect(200);
      expect(editada.body).toMatchObject({ status: 'confirmed', partySize: 6 });
    });

    /**
     * Antes esto era un **500**: el `tableId` inexistente llegaba al `INSERT` y reventaba la
     * clave ajena. Un id equivocado en un formulario es un error del cliente.
     */
    it('una mesa que no existe da 404, no 500', async () => {
      await http()
        .post('/api/tables/reservations')
        .set('Cookie', admin)
        .send({
          tableId: UUID_INEXISTENTE,
          customerName: 'Ana',
          partySize: 2,
          reservedAt: enHoras(3),
        })
        .expect(404);
    });

    it('no se puede reservar dos veces la misma mesa a la misma hora', async () => {
      const sector = await newSector();
      const mesa = await newTable(sector.id);
      const hora = enHoras(3);

      await http()
        .post('/api/tables/reservations')
        .set('Cookie', admin)
        .send({ tableId: mesa.id, customerName: 'Ana', partySize: 4, reservedAt: hora })
        .expect(201);

      const choque = await http()
        .post('/api/tables/reservations')
        .set('Cookie', admin)
        .send({ tableId: mesa.id, customerName: 'Luis', partySize: 2, reservedAt: hora })
        .expect(409);
      expect(String(choque.body.message)).toMatch(/reserva a esa hora/i);
    });

    it('una reserva cancelada deja la mesa libre otra vez', async () => {
      const sector = await newSector();
      const mesa = await newTable(sector.id);
      const hora = enHoras(3);

      const primera = await http()
        .post('/api/tables/reservations')
        .set('Cookie', admin)
        .send({ tableId: mesa.id, customerName: 'Ana', partySize: 4, reservedAt: hora })
        .expect(201);

      await http()
        .patch(`/api/tables/reservations/${primera.body.id}`)
        .set('Cookie', admin)
        .send({ status: 'cancelled' })
        .expect(200);

      await http()
        .post('/api/tables/reservations')
        .set('Cookie', admin)
        .send({ tableId: mesa.id, customerName: 'Luis', partySize: 2, reservedAt: hora })
        .expect(201);
    });

    it('con cuatro horas de diferencia no hay solape', async () => {
      const sector = await newSector();
      const mesa = await newTable(sector.id);

      await http()
        .post('/api/tables/reservations')
        .set('Cookie', admin)
        .send({ tableId: mesa.id, customerName: 'Ana', partySize: 4, reservedAt: enHoras(3) })
        .expect(201);
      await http()
        .post('/api/tables/reservations')
        .set('Cookie', admin)
        .send({ tableId: mesa.id, customerName: 'Luis', partySize: 2, reservedAt: enHoras(7) })
        .expect(201);
    });

    /** El PATCH no puede ser la puerta de atrás por la que entra lo que el POST rechaza. */
    it('mover una reserva encima de otra también da 409', async () => {
      const sector = await newSector();
      const mesa = await newTable(sector.id);

      await http()
        .post('/api/tables/reservations')
        .set('Cookie', admin)
        .send({ tableId: mesa.id, customerName: 'Ana', partySize: 4, reservedAt: enHoras(3) })
        .expect(201);
      const segunda = await http()
        .post('/api/tables/reservations')
        .set('Cookie', admin)
        .send({ tableId: mesa.id, customerName: 'Luis', partySize: 2, reservedAt: enHoras(7) })
        .expect(201);

      await http()
        .patch(`/api/tables/reservations/${segunda.body.id}`)
        .set('Cookie', admin)
        .send({ reservedAt: enHoras(3) })
        .expect(409);
    });

    it('editar una reserva sin moverla no choca consigo misma', async () => {
      const sector = await newSector();
      const mesa = await newTable(sector.id);

      const creada = await http()
        .post('/api/tables/reservations')
        .set('Cookie', admin)
        .send({ tableId: mesa.id, customerName: 'Ana', partySize: 4, reservedAt: enHoras(3) })
        .expect(201);

      await http()
        .patch(`/api/tables/reservations/${creada.body.id}`)
        .set('Cookie', admin)
        .send({ partySize: 6 })
        .expect(200);
    });

    it('rechaza un cuerpo con campos de más', async () => {
      // `forbidNonWhitelisted`: un campo mal escrito tiene que fallar, no ignorarse en silencio.
      const sector = await newSector();
      const mesa = await newTable(sector.id);

      await http()
        .post('/api/tables/reservations')
        .set('Cookie', admin)
        .send({
          tableId: mesa.id,
          customerName: 'Ana',
          partySize: 2,
          reservedAt: enHoras(3),
          comensales: 4,
        })
        .expect(400);
    });

    it('se borra', async () => {
      const sector = await newSector();
      const mesa = await newTable(sector.id);
      const creada = await http()
        .post('/api/tables/reservations')
        .set('Cookie', admin)
        .send({ tableId: mesa.id, customerName: 'Ana', partySize: 4, reservedAt: enHoras(3) })
        .expect(201);

      await http()
        .delete(`/api/tables/reservations/${creada.body.id}`)
        .set('Cookie', admin)
        .expect(204);
      await http()
        .get(`/api/tables/reservations/${creada.body.id}`)
        .set('Cookie', admin)
        .expect(404);
    });
  });
});
