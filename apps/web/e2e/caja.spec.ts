import { expect, test, type Browser, type Page } from '@playwright/test';
import { ROLES } from './support/roles';
import { query, resetOperationalData } from './support/db';

/**
 * La caja: turno, cobro en dos métodos, descuento con aprobación y arqueo.
 *
 * Es donde está el dinero, así que las aserciones que importan van **contra la base**: lo que la
 * pantalla enseña puede ser optimista —y con la cola sin conexión lo es a propósito—, y lo que
 * hay que saber es qué quedó escrito.
 */

test.use({ storageState: ROLES.cajero.file });

test.describe('Caja', () => {
  test.beforeEach(async () => {
    await resetOperationalData();
  });

  /** Una cuenta abierta en la mesa indicada, creada desde la sesión del mesero, que es quien puede. */
  async function comandaDeMesa(browser: Browser, mesa = 1) {
    const salon = await browser.newContext({ storageState: ROLES.mesero.file });
    const mesero = await salon.newPage();
    try {
      await mesero.goto('/waiter');
      await mesero.getByRole('button', { name: new RegExp(`^Mesa ${mesa} —`) }).click();
      await mesero.waitForURL('**/waiter/mesa/**');
      await mesero.getByRole('button', { name: 'Nueva cuenta' }).click();
      await mesero.waitForURL('**/waiter/nueva**');
      await mesero.getByRole('button', { name: /Tacos al pastor/ }).click();
      await mesero.getByRole('button', { name: 'Enviar cuenta' }).click();
      await mesero.waitForURL('**/waiter/orden/**');
    } finally {
      await salon.close();
    }

    const [orden] = await query<{ id: string; order_number: number; total: string }>(
      `SELECT id, order_number, total FROM orders ORDER BY created_at DESC LIMIT 1`,
    );
    return { ...orden, total: Number(orden.total) };
  }

  async function abrirTurno(page: Page, fondo = '100') {
    await page.goto('/pos');
    await page.getByRole('button', { name: 'Abrir turno' }).click();
    // Dentro del diálogo: el disparador y el botón de confirmar se llaman igual.
    const dialogo = page.getByRole('dialog');
    await dialogo.locator('input').first().fill(fondo);
    await dialogo.getByRole('button', { name: 'Abrir turno' }).click();
    await expect(page.getByRole('button', { name: /^Turno ·/ })).toBeVisible({ timeout: 10_000 });
  }

  const estadoDe = async (id: string) =>
    (await query<{ status: string }>(`SELECT status FROM orders WHERE id = $1`, [id]))[0].status;

  test('sin turno abierto no se puede cobrar, y el cajero lo ve', async ({ page, browser }) => {
    // La regla vive en el servidor. Lo que se comprueba aquí es que llegue a la pantalla: un 400
    // silencioso en la consola sería un botón que no hace nada.
    const orden = await comandaDeMesa(browser);

    await page.goto(`/pos/${orden.id}`);
    await expect(page.getByText(/turno/i).first()).toBeVisible();

    expect(await query(`SELECT id FROM payments`)).toHaveLength(0);
  });

  test('cobro en dos métodos: se cierra al saldarse, no antes', async ({ page, browser }) => {
    const orden = await comandaDeMesa(browser);
    await abrirTurno(page);

    await page.goto(`/pos/${orden.id}`);

    const mitad = (orden.total / 2).toFixed(2);
    await page.getByRole('button', { name: 'Efectivo', exact: true }).click();
    await page.getByLabel('Monto a cobrar').fill(mitad);
    await page.getByRole('button', { name: 'Registrar pago' }).click();

    // A medias sigue abierta: es la barandilla de `updateStatus`, que rechaza cerrar con saldo.
    await expect(page.getByText('Restante')).toBeVisible();
    await expect.poll(() => estadoDe(orden.id), { timeout: 10_000 }).not.toBe('closed');

    await page.getByRole('button', { name: 'Tarjeta', exact: true }).click();
    await page.getByLabel('Monto a cobrar').fill(mitad);
    await page.getByRole('button', { name: 'Registrar pago' }).click();

    await expect.poll(() => estadoDe(orden.id), { timeout: 15_000 }).toBe('closed');

    const metodos = await query<{ method: string }>(
      `SELECT method FROM payments WHERE order_id = $1 ORDER BY processed_at`,
      [orden.id],
    );
    expect(metodos.map((m) => m.method).sort()).toEqual(['card', 'cash']);
  });

  test('el arqueo cuadra: fondo más efectivo, y la tarjeta no cuenta para el cajón', async ({
    page,
    browser,
  }) => {
    const orden = await comandaDeMesa(browser);
    await abrirTurno(page, '100');

    await page.goto(`/pos/${orden.id}`);
    await page.getByRole('button', { name: 'Efectivo', exact: true }).click();
    await page.getByRole('button', { name: 'Registrar pago' }).click();
    await expect.poll(() => estadoDe(orden.id), { timeout: 15_000 }).toBe('closed');

    await page.goto('/pos');
    await page.getByRole('button', { name: /^Turno ·/ }).click();

    const arqueo = page.getByRole('dialog');
    const esperado = 100 + orden.total;
    // Lo esperado en el cajón lo calcula el servidor; el cajero solo cuenta lo que tiene.
    await expect(arqueo.getByText(`$${esperado.toFixed(2)}`).first()).toBeVisible();

    await arqueo.getByLabel('Efectivo contado').fill(esperado.toFixed(2));
    await arqueo.getByRole('button', { name: 'Cerrar turno' }).click();

    await expect(page.getByRole('button', { name: 'Abrir turno' })).toBeVisible({
      timeout: 10_000,
    });

    const [turno] = await query<{
      status: string;
      closing_cash: string;
      total_sales: string;
    }>(`SELECT status, closing_cash, total_sales FROM shifts ORDER BY opened_at DESC LIMIT 1`);
    expect(turno.status).toBe('closed');
    expect(Number(turno.total_sales)).toBeCloseTo(orden.total, 2);
    expect(Number(turno.closing_cash)).toBeCloseTo(esperado, 2);
  });

  test('un descuento por encima del umbral queda pendiente y no toca el total', async ({
    page,
    browser,
  }) => {
    const orden = await comandaDeMesa(browser);
    await abrirTurno(page);

    await page.goto(`/pos/${orden.id}`);
    await page.getByRole('button', { name: 'Descuento' }).click();

    const dialogo = page.getByRole('dialog');
    await dialogo.getByRole('button', { name: 'Porcentaje' }).click();
    await dialogo.locator('input[type=number]').first().fill('90');
    // El motivo es obligatorio, y con razón: un descuento sin explicación es un agujero en la
    // caja que nadie puede auditar después.
    await dialogo.getByLabel('Motivo').fill('Cliente frecuente');
    // El botón **cambia de texto** cuando el porcentaje pasa del umbral del rol: es la primera
    // señal que recibe el cajero de que eso no lo autoriza él.
    await expect(dialogo.getByRole('button', { name: 'Enviar a aprobación' })).toBeVisible();
    await dialogo.getByRole('button', { name: 'Enviar a aprobación' }).click();

    // El descuento existe, pero **no se ha aplicado**. Eso es lo que lo convierte en un control y
    // no en un formulario: el 90 % espera a que lo apruebe alguien con permiso.
    await expect
      .poll(
        async () => {
          const filas = await query<{ status: string }>(
            `SELECT status FROM discounts WHERE order_id = $1`,
            [orden.id],
          );
          return filas[0]?.status ?? null;
        },
        { timeout: 10_000 },
      )
      .toBe('pending');

    const [cuenta] = await query<{ discount_amount: string; total: string }>(
      `SELECT discount_amount, total FROM orders WHERE id = $1`,
      [orden.id],
    );
    expect(Number(cuenta.discount_amount)).toBe(0);
    expect(Number(cuenta.total)).toBeCloseTo(orden.total, 2);
  });
});
