import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { cookieFor } from './app';

/**
 * Datos que el seed deja en la base de pruebas. Se consultan en vez de codificarlos porque
 * los ids son uuid generados en cada siembra.
 *
 * Hace falta lo real —y no un uuid inventado— siempre que el backend valide contra la base:
 * el umbral de descuento se lee del rol, los turnos de caja se abren por usuario, y las
 * notificaciones tienen clave ajena a `users`.
 */

export interface SeededUser {
  id: string;
  name: string;
  roleId: string;
  roleName: string;
}

export async function seededUser(app: INestApplication, email: string): Promise<SeededUser> {
  const rows: SeededUser[] = await app.get(DataSource).query(
    `SELECT u.id, u.name, u.role_id AS "roleId", r.name AS "roleName"
       FROM users u JOIN roles r ON r.id = u.role_id
      WHERE u.email = $1`,
    [email],
  );
  if (rows.length === 0) throw new Error(`El seed no creó al usuario ${email}`);
  return rows[0];
}

export async function seededRole(
  app: INestApplication,
  name: string,
): Promise<{ id: string; maxDiscountPercentage: number }> {
  const rows: { id: string; max: string }[] = await app
    .get(DataSource)
    .query(`SELECT id, max_discount_percentage AS max FROM roles WHERE name = $1`, [name]);
  if (rows.length === 0) throw new Error(`El seed no creó el rol ${name}`);
  return { id: rows[0].id, maxDiscountPercentage: Number(rows[0].max) };
}

export async function firstProduct(
  app: INestApplication,
): Promise<{ id: string; name: string; price: number }> {
  const rows: { id: string; name: string; price: string }[] = await app
    .get(DataSource)
    .query(`SELECT id, name, price FROM products WHERE is_active = true ORDER BY name LIMIT 1`);
  if (rows.length === 0) throw new Error('El seed no creó productos');
  return { id: rows[0].id, name: rows[0].name, price: Number(rows[0].price) };
}

export async function firstTable(
  app: INestApplication,
): Promise<{ id: string; number: number; status: string }> {
  const rows: { id: string; number: number; status: string }[] = await app
    .get(DataSource)
    .query(`SELECT id, number, status FROM tables ORDER BY number LIMIT 1`);
  if (rows.length === 0) throw new Error('El seed no creó mesas');
  return rows[0];
}

export async function tableStatus(app: INestApplication, tableId: string): Promise<string> {
  const rows: { status: string }[] = await app
    .get(DataSource)
    .query(`SELECT status FROM tables WHERE id = $1`, [tableId]);
  return rows[0]?.status;
}

/**
 * Cookie de sesión con el **usuario y el rol reales** del seed, más los permisos que se le
 * quieran dar. Los permisos siguen siendo explícitos —no se leen del rol— para que cada
 * test declare exactamente la autorización que necesita.
 */
export async function sessionAs(
  app: INestApplication,
  email: string,
  permissions: string[],
): Promise<string> {
  const user = await seededUser(app, email);
  return cookieFor(permissions, {
    sub: user.id,
    name: user.name,
    email,
    roleId: user.roleId,
    roleName: user.roleName,
  });
}
