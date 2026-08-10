import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { closeTestApp, createTestApp } from '../../test/app';
import { seededRole, sessionAs } from '../../test/fixtures';

/**
 * Empleados.
 *
 * Lo que de verdad se comprueba aquí cabe en dos frases: **la respuesta HTTP no lleva nunca el
 * hash del PIN ni el de la contraseña**, y el roster público del PIN pad no es un directorio de
 * empleados para quien no ha entrado. Lo demás es el CRUD que lo rodea.
 *
 * `select: false` en la entidad es la garantía, pero se afirma en el borde: es donde importa y
 * es lo que un `createQueryBuilder` mal escrito rompería sin que nada más se enterara.
 */
describe('Empleados', () => {
  let app: INestApplication;
  let ds: DataSource;
  let admin: string;
  let meseroRoleId: string;

  const creados: string[] = [];
  const UUID_INEXISTENTE = '00000000-0000-4000-8000-000000000999';

  beforeAll(async () => {
    app = await createTestApp();
    ds = app.get(DataSource);
    admin = await sessionAs(app, 'admin@loklflow.com', [
      'users:create',
      'users:read',
      'users:update',
      'users:delete',
    ]);
    meseroRoleId = (await seededRole(app, 'Mesero')).id;
  });

  afterAll(async () => {
    if (creados.length > 0) {
      await ds.query(`DELETE FROM "users" WHERE id = ANY($1::uuid[])`, [creados]);
    }
    await closeTestApp(app);
  });

  const http = () => request(app.getHttpServer());

  let seq = 0;
  async function newUser(body: Record<string, unknown> = {}) {
    const n = ++seq;
    const res = await http()
      .post('/api/users')
      .set('Cookie', admin)
      .send({
        name: `Empleado de prueba ${n}`,
        email: `prueba.${n}.${Date.now()}@loklflow.test`,
        password: 'contrasena-larga',
        roleId: meseroRoleId,
        ...body,
      })
      .expect(201);
    creados.push(res.body.id);
    return res.body as { id: string; name: string };
  }

  /** Busca recursivamente cualquier clave sospechosa en el cuerpo de una respuesta. */
  function credencialesEn(value: unknown): string[] {
    const hits: string[] = [];
    const walk = (node: unknown) => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (node && typeof node === 'object') {
        for (const [key, child] of Object.entries(node)) {
          if (/^(password|pin)$/i.test(key) && child != null) hits.push(key);
          walk(child);
        }
      }
    };
    walk(value);
    return hits;
  }

  describe('credenciales', () => {
    it('la respuesta de crear no lleva ni contraseña ni PIN', async () => {
      const res = await http()
        .post('/api/users')
        .set('Cookie', admin)
        .send({
          name: 'Con credenciales',
          email: `cred.${Date.now()}@loklflow.test`,
          password: 'contrasena-larga',
          pin: '2846',
          roleId: meseroRoleId,
        })
        .expect(201);
      creados.push(res.body.id);

      expect(credencialesEn(res.body)).toEqual([]);
      // Y sí se guardaron, hasheadas: si no, este test pasaría con un servicio que las tira.
      const rows = await ds.query(
        `SELECT password, pin FROM users WHERE id = $1`,
        [res.body.id],
      );
      expect(rows[0].password).toMatch(/^\$2[aby]\$/);
      expect(rows[0].pin).toMatch(/^\$2[aby]\$/);
    });

    it('tampoco al leer uno, al listarlos ni al editarlos', async () => {
      const user = await newUser({ pin: '9173' });

      const uno = await http().get(`/api/users/${user.id}`).set('Cookie', admin).expect(200);
      const todos = await http().get('/api/users').set('Cookie', admin).expect(200);
      const editado = await http()
        .patch(`/api/users/${user.id}`)
        .set('Cookie', admin)
        .send({ name: 'Renombrado' })
        .expect(200);

      expect(credencialesEn(uno.body)).toEqual([]);
      expect(credencialesEn(todos.body)).toEqual([]);
      expect(credencialesEn(editado.body)).toEqual([]);
    });

    it('un PIN de los que la gente elige de verdad se rechaza', async () => {
      const res = await http()
        .post('/api/users')
        .set('Cookie', admin)
        .send({
          name: 'PIN flojo',
          pin: '1234',
          roleId: meseroRoleId,
        })
        .expect(400);

      expect(JSON.stringify(res.body.message)).toMatch(/secuencia/i);
    });

    it('cambiar el PIN por uno flojo tampoco cuela', async () => {
      const user = await newUser();

      await http()
        .patch(`/api/users/${user.id}`)
        .set('Cookie', admin)
        .send({ pin: '0000' })
        .expect(400);
    });
  });

  describe('altas y bajas', () => {
    it('un empleado sin correo ni PIN no puede entrar por ningún lado', async () => {
      const res = await http()
        .post('/api/users')
        .set('Cookie', admin)
        .send({ name: 'Fantasma', roleId: meseroRoleId })
        .expect(400);

      expect(String(res.body.message)).toMatch(/email or a PIN/i);
    });

    it('un correo repetido da 400', async () => {
      const user = await newUser();
      const suyo = await http().get(`/api/users/${user.id}`).set('Cookie', admin).expect(200);

      await http()
        .post('/api/users')
        .set('Cookie', admin)
        .send({
          name: 'Clon',
          email: suyo.body.email,
          password: 'contrasena-larga',
          roleId: meseroRoleId,
        })
        .expect(400);
    });

    it('un rol que no existe da 404', async () => {
      await http()
        .post('/api/users')
        .set('Cookie', admin)
        .send({
          name: 'Sin rol',
          email: `sinrol.${Date.now()}@loklflow.test`,
          password: 'contrasena-larga',
          roleId: UUID_INEXISTENTE,
        })
        .expect(404);
    });

    it('la baja es lógica y lo saca del listado', async () => {
      const user = await newUser();

      await http().delete(`/api/users/${user.id}`).set('Cookie', admin).expect(204);

      const listado = await http().get('/api/users').set('Cookie', admin).expect(200);
      expect((listado.body as { id: string }[]).some((u) => u.id === user.id)).toBe(false);

      // La fila sigue ahí: los pedidos, los turnos y la bitácora la referencian.
      const rows = await ds.query(`SELECT is_active FROM users WHERE id = $1`, [user.id]);
      expect(rows[0].is_active).toBe(false);
    });

    it('dar de baja invalida la sesión en el acto', async () => {
      // La versión de token es lo que convierte «desactivado» en «fuera ahora», y no «fuera
      // cuando caduque su token dentro de cuatro horas».
      const user = await newUser();
      const antes = await ds.query(`SELECT token_version FROM users WHERE id = $1`, [user.id]);

      await http().delete(`/api/users/${user.id}`).set('Cookie', admin).expect(204);

      const despues = await ds.query(`SELECT token_version FROM users WHERE id = $1`, [user.id]);
      expect(despues[0].token_version).toBeGreaterThan(antes[0].token_version);
    });

    it('cambiar el rol queda auditado aparte', async () => {
      const user = await newUser();
      const cajero = await seededRole(app, 'Cajero');

      await http()
        .patch(`/api/users/${user.id}`)
        .set('Cookie', admin)
        .send({ roleId: cajero.id })
        .expect(200);

      const rows = await ds.query(
        `SELECT new_value FROM audit_logs WHERE action = 'user.role_changed' AND entity_id = $1`,
        [user.id],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].new_value).toMatchObject({ role: 'Cajero' });
    });

    it('la bitácora del alta no arrastra credenciales', async () => {
      // `audit_logs` lo puede leer el rol Gerente: un volcado de la entidad pondría ahí el hash.
      const user = await newUser({ pin: '5029' });

      const rows = await ds.query(
        `SELECT new_value FROM audit_logs WHERE action = 'user.created' AND entity_id = $1`,
        [user.id],
      );
      expect(credencialesEn(rows[0].new_value)).toEqual([]);
    });

    it('uno que no existe da 404', async () => {
      await http().get(`/api/users/${UUID_INEXISTENTE}`).set('Cookie', admin).expect(404);
    });

    it('exige permiso', async () => {
      const sinPermiso = await sessionAs(app, 'mesero@loklflow.com', ['orders:read']);
      await http().get('/api/users').set('Cookie', sinPermiso).expect(403);
    });
  });

  /**
   * `/users/operational` es **público** a propósito: sin él habría que teclear un uuid para
   * entrar, y la plantilla de un restaurante se ve desde la barra. Lo que se comprueba es que
   * publique lo mínimo.
   */
  describe('roster del PIN pad', () => {
    it('se lee sin sesión y solo trae id, nombre y rol', async () => {
      const res = await http().get('/api/users/operational').expect(200);

      expect(res.body.length).toBeGreaterThan(0);
      for (const u of res.body as Record<string, unknown>[]) {
        expect(Object.keys(u).sort()).toEqual(['id', 'name', 'role']);
        expect(Object.keys(u.role as object)).toEqual(['name']);
      }
    });

    it('no incluye a quien entra por correo', async () => {
      // El administrador no tiene PIN; que apareciera sería publicar una cuenta que el PIN pad
      // ni siquiera puede usar.
      const res = await http().get('/api/users/operational').expect(200);
      const nombres = (res.body as { name: string }[]).map((u) => u.name);

      const admins = await ds.query(
        `SELECT name FROM users WHERE pin IS NULL AND is_active = true`,
      );
      for (const a of admins as { name: string }[]) {
        expect(nombres).not.toContain(a.name);
      }
    });

    it('el de uno solo devuelve un nombre, no el roster entero', async () => {
      const roster = await http().get('/api/users/operational').expect(200);
      const primero = roster.body[0] as { id: string; name: string };

      const uno = await http().get(`/api/users/operational/${primero.id}`).expect(200);
      expect(uno.body).toMatchObject({ id: primero.id, name: primero.name });
    });

    it('«no existe», «de baja» y «sin PIN» dan el mismo 404', async () => {
      // Distinguirlos convertiría el endpoint en un buscador de empleados para un anónimo.
      const sinPin = await newUser();

      const inexistente = await http().get(`/api/users/operational/${UUID_INEXISTENTE}`);
      const sinPinRes = await http().get(`/api/users/operational/${sinPin.id}`);

      expect(inexistente.status).toBe(404);
      expect(sinPinRes.status).toBe(404);
      expect(sinPinRes.body.message).toBe(inexistente.body.message);
    });
  });
});
