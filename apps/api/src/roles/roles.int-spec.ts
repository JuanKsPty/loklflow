import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { closeTestApp, createTestApp } from '../../test/app';
import { seededRole, sessionAs } from '../../test/fixtures';

/**
 * Roles y permisos.
 *
 * Los roles del seed son **catálogo compartido**: `resetOperationalData` no los toca, así que
 * esta suite trabaja siempre con un rol propio y lo borra al final. Cambiar los permisos de
 * `Mesero` aquí se lo llevaría puesto a media docena de suites según el orden de ejecución —ya
 * pasó una vez.
 *
 * Lo que se comprueba: que los roles de sistema no se puedan renombrar ni borrar, y que cambiar
 * los permisos de un rol **invalide las sesiones de quien lo tiene**. Sin eso, quitar un permiso
 * no surtía efecto hasta que caducara el token: cuatro horas de acceso ya revocado.
 */
describe('Roles y permisos', () => {
  let app: INestApplication;
  let ds: DataSource;
  let admin: string;

  const creados: string[] = [];
  const UUID_INEXISTENTE = '00000000-0000-4000-8000-000000000999';

  beforeAll(async () => {
    app = await createTestApp();
    ds = app.get(DataSource);
    admin = await sessionAs(app, 'admin@loklflow.com', [
      'roles:create',
      'roles:read',
      'roles:update',
      'roles:delete',
    ]);
  });

  afterAll(async () => {
    if (creados.length > 0) {
      await ds.query(`DELETE FROM "role_permissions" WHERE role_id = ANY($1::uuid[])`, [creados]);
      await ds.query(`DELETE FROM "users" WHERE role_id = ANY($1::uuid[])`, [creados]);
      await ds.query(`DELETE FROM "roles" WHERE id = ANY($1::uuid[])`, [creados]);
    }
    await closeTestApp(app);
  });

  const http = () => request(app.getHttpServer());

  let seq = 0;
  async function newRole(body: Record<string, unknown> = {}) {
    const res = await http()
      .post('/api/roles')
      .set('Cookie', admin)
      .send({ name: `Rol de prueba ${++seq}-${Date.now()}`, ...body })
      .expect(201);
    creados.push(res.body.id);
    return res.body as { id: string; name: string };
  }

  async function permissionIds(...keys: string[]): Promise<string[]> {
    const rows = await ds.query(`SELECT id FROM permissions WHERE key = ANY($1::text[])`, [keys]);
    expect(rows).toHaveLength(keys.length);
    return (rows as { id: string }[]).map((r) => r.id);
  }

  it('se crean, se listan y se editan', async () => {
    const rol = await newRole({ description: 'Para pruebas', maxDiscountPercentage: 15 });

    const listado = await http().get('/api/roles').set('Cookie', admin).expect(200);
    expect((listado.body as { id: string }[]).some((r) => r.id === rol.id)).toBe(true);

    const editado = await http()
      .patch(`/api/roles/${rol.id}`)
      .set('Cookie', admin)
      .send({ maxDiscountPercentage: 25 })
      .expect(200);
    expect(Number(editado.body.maxDiscountPercentage)).toBe(25);
  });

  it('un nombre repetido da 400', async () => {
    const rol = await newRole();

    await http().post('/api/roles').set('Cookie', admin).send({ name: rol.name }).expect(400);
  });

  it('un descuento máximo por encima de 100 se rechaza', async () => {
    await http()
      .post('/api/roles')
      .set('Cookie', admin)
      .send({ name: `Generoso ${Date.now()}`, maxDiscountPercentage: 150 })
      .expect(400);
  });

  describe('roles de sistema', () => {
    it('no se renombran', async () => {
      const mesero = await seededRole(app, 'Mesero');

      const res = await http()
        .patch(`/api/roles/${mesero.id}`)
        .set('Cookie', admin)
        .send({ name: 'Camarero' })
        .expect(400);
      expect(String(res.body.message)).toMatch(/rename system roles/i);
    });

    it('no se borran', async () => {
      const mesero = await seededRole(app, 'Mesero');

      const res = await http()
        .delete(`/api/roles/${mesero.id}`)
        .set('Cookie', admin)
        .expect(400);
      expect(String(res.body.message)).toMatch(/delete system roles/i);
    });

    it('pero su umbral de descuento sí se puede ajustar', async () => {
      // Es el único campo que un gerente necesita tocar, y renombrar/borrar es lo que rompería
      // las comprobaciones que buscan el rol por nombre.
      const mesero = await seededRole(app, 'Mesero');

      await http()
        .patch(`/api/roles/${mesero.id}`)
        .set('Cookie', admin)
        .send({ maxDiscountPercentage: mesero.maxDiscountPercentage })
        .expect(200);
    });
  });

  describe('asignación de permisos', () => {
    it('reemplaza el conjunto entero, no lo acumula', async () => {
      const rol = await newRole();
      const [a, b, c] = await permissionIds('orders:read', 'orders:create', 'menu:read');

      await http()
        .put(`/api/roles/${rol.id}/permissions`)
        .set('Cookie', admin)
        .send({ permissionIds: [a, b] })
        .expect(200);

      const res = await http()
        .put(`/api/roles/${rol.id}/permissions`)
        .set('Cookie', admin)
        .send({ permissionIds: [c] })
        .expect(200);

      const keys = (res.body.rolePermissions as { permission: { key: string } }[]).map(
        (rp) => rp.permission.key,
      );
      expect(keys).toEqual(['menu:read']);
    });

    it('un permiso inexistente da 400 y no cambia nada', async () => {
      const rol = await newRole();
      const [a] = await permissionIds('orders:read');

      await http()
        .put(`/api/roles/${rol.id}/permissions`)
        .set('Cookie', admin)
        .send({ permissionIds: [a] })
        .expect(200);

      await http()
        .put(`/api/roles/${rol.id}/permissions`)
        .set('Cookie', admin)
        .send({ permissionIds: [a, UUID_INEXISTENTE] })
        .expect(400);

      const rows = await ds.query(
        `SELECT count(*)::int AS n FROM role_permissions WHERE role_id = $1`,
        [rol.id],
      );
      expect(rows[0].n).toBe(1);
    });

    /**
     * Los permisos viajan **dentro del token**. Cambiarlos sin subir la versión de sesión
     * significa que quitar un permiso no hace nada durante las cuatro horas siguientes.
     */
    it('cambiarlos invalida las sesiones de quien tiene ese rol', async () => {
      const rol = await newRole();
      const [a] = await permissionIds('orders:read');

      await ds.query(
        `INSERT INTO users (name, pin, role_id, is_active) VALUES ($1, $2, $3, true)`,
        ['Empleado del rol de prueba', '$2b$10$noimporta', rol.id],
      );
      const antes = await ds.query(`SELECT token_version FROM users WHERE role_id = $1`, [rol.id]);

      await http()
        .put(`/api/roles/${rol.id}/permissions`)
        .set('Cookie', admin)
        .send({ permissionIds: [a] })
        .expect(200);

      const despues = await ds.query(`SELECT token_version FROM users WHERE role_id = $1`, [
        rol.id,
      ]);
      expect(despues[0].token_version).toBeGreaterThan(antes[0].token_version);
    });

    it('el cambio queda auditado con el antes y el después', async () => {
      const rol = await newRole();
      const [a, b] = await permissionIds('orders:read', 'menu:read');

      await http()
        .put(`/api/roles/${rol.id}/permissions`)
        .set('Cookie', admin)
        .send({ permissionIds: [a] })
        .expect(200);
      await http()
        .put(`/api/roles/${rol.id}/permissions`)
        .set('Cookie', admin)
        .send({ permissionIds: [b] })
        .expect(200);

      const rows = await ds.query(
        `SELECT old_value, new_value FROM audit_logs
          WHERE action = 'role.permissions_changed' AND entity_id = $1
          ORDER BY created_at ASC`,
        [rol.id],
      );
      expect(rows).toHaveLength(2);
      expect(rows[1].old_value).toEqual({ permissions: ['orders:read'] });
      expect(rows[1].new_value).toEqual({ permissions: ['menu:read'] });
    });
  });

  it('el catálogo de permisos se lista ordenado por módulo', async () => {
    const res = await http().get('/api/roles/permissions').set('Cookie', admin).expect(200);

    const modulos = (res.body as { module: string }[]).map((p) => p.module);
    expect(modulos).toEqual([...modulos].sort());
  });

  it('uno que no existe da 404', async () => {
    await http().get(`/api/roles/${UUID_INEXISTENTE}`).set('Cookie', admin).expect(404);
  });

  it('exige permiso', async () => {
    const sinPermiso = await sessionAs(app, 'mesero@loklflow.com', ['orders:read']);
    await http().get('/api/roles').set('Cookie', sinPermiso).expect(403);
  });
});
