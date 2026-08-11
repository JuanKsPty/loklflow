import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { ROLES } from './support/roles';
import { query, resetOperationalData } from './support/db';

/**
 * El servicio completo, de la comanda al cobro.
 *
 * Es el spec que justifica levantar la API y la base de verdad: recorre las cuatro superficies
 * del producto con tres roles a la vez, y contiene **la única aserción de tiempo real de todo el
 * repo** — la comanda aparece en la pantalla de cocina sin que nadie recargue. Esa línea es la
 * que separa «hay un gateway de sockets» de «el gateway funciona».
 *
 * Es también el guion del vídeo de demostración: los hitos van en orden y con `E2E_CAPTURAS=1`
 * deja las capturas en `docs/images/`. Así se regeneran cuando cambia la UI en vez de pudrirse,
 * que es la misma respuesta que «no cites cifras exactas en el README».
 *
 * Reglas contra la intermitencia, en todo el archivo: cero `waitForTimeout`, localizadores por
 * rol o por texto con `toBeVisible()`, y la aserción del socket con su propio `timeout` — un
 * `sleep` de tres segundos sería más lento *y* menos fiable.
 *
 * Detalle que cuesta una tarde si no se sabe: los `Button` con `nativeButton={false}` renderizan
 * un `<a>` pero conservan `role="button"`, así que **se localizan como botón**, no como enlace.
 */

const CAPTURAS = process.env.E2E_CAPTURAS === '1';
const DIR = '../../docs/images';

async function capturar(page: Page, nombre: string) {
  if (!CAPTURAS) return;
  mkdirSync(DIR, { recursive: true });
  await page.screenshot({ path: `${DIR}/${nombre}.png` });
}

test.describe('Servicio completo', () => {
  test.beforeEach(async () => {
    await resetOperationalData();
  });

  test('de la comanda al cobro, pasando por cocina', async ({ browser }) => {
    // Tres contextos, uno por rol: es como ocurre en el local, y es lo que permite comprobar que
    // la pantalla de cocina reacciona a lo que hace el mesero en otro dispositivo.
    const salon = await browser.newContext({ storageState: ROLES.mesero.file });
    const cocina = await browser.newContext({ storageState: ROLES.cocina.file });
    const caja = await browser.newContext({ storageState: ROLES.cajero.file });

    const mesero = await salon.newPage();
    const chef = await cocina.newPage();
    const cajero = await caja.newPage();

    try {
      // ── 1. Cocina, con la pantalla vacía y mirando ───────────────────────────────────
      await chef.goto('/kitchen');
      await expect(chef.getByRole('heading', { name: 'Pendientes' })).toBeVisible();

      // ── 2. El mesero abre la mesa 1 ──────────────────────────────────────────────────
      await mesero.goto('/waiter');
      await expect(mesero.getByRole('heading', { name: 'Salón' })).toBeVisible();
      await capturar(mesero, '01-salon');

      await mesero.getByRole('button', { name: /^Mesa 1 —/ }).click();
      await mesero.waitForURL('**/waiter/mesa/**');
      await expect(mesero.getByRole('heading', { name: 'Mesa 1' })).toBeVisible();

      // ── 3. Comanda: dos tacos y un refresco ──────────────────────────────────────────
      await mesero.getByRole('button', { name: 'Nueva cuenta' }).click();
      await mesero.waitForURL('**/waiter/nueva**');

      await mesero.getByRole('button', { name: /Tacos al pastor/ }).click();
      await mesero.getByRole('button', { name: /Tacos al pastor/ }).click();
      await mesero.getByRole('button', { name: /^Refresco/ }).click();
      await expect(mesero.getByText('Subtotal (3)')).toBeVisible();
      await capturar(mesero, '02-comanda');

      await mesero.getByRole('button', { name: 'Enviar cuenta' }).click();
      await mesero.waitForURL('**/waiter/orden/**');

      const [creada] = await query<{ order_number: number; id: string; total: string }>(
        `SELECT id, order_number, total FROM orders ORDER BY created_at DESC LIMIT 1`,
      );
      const numero = creada.order_number;
      // Los precios los pone el servidor, nunca el cliente: 2×95 + 30.
      expect(Number(creada.total)).toBeCloseTo(220, 2);

      // ── 4. **La aserción del tiempo real.** Sin recargar nada. ───────────────────────
      // Si el gateway dejara de emitir, esto es lo único del repo que se pondría rojo.
      //
      // Se busca la tarjeta dentro de `main`, no el texto suelto: el aviso emergente de sonner
      // también dice «Nueva orden #N» —y lo pinta por duplicado, uno de ellos para lectores de
      // pantalla—, así que afirmar sobre el texto pasaría con el cartel y sin comanda ninguna.
      const columnaPendientes = chef.locator('section', { hasText: 'Pendientes' });
      await expect(columnaPendientes.getByText(`#${numero}`, { exact: true })).toBeVisible({
        timeout: 15_000,
      });
      await capturar(chef, '03-cocina');

      // ── 5. Cocina la avanza hasta «lista» ────────────────────────────────────────────
      await chef.getByRole('button', { name: 'Comenzar' }).click();
      await chef.getByRole('button', { name: 'Marcar lista' }).click();

      await expect
        .poll(
          async () => {
            const [o] = await query<{ status: string }>(
              `SELECT status FROM orders WHERE id = $1`,
              [creada.id],
            );
            return o.status;
          },
          { timeout: 15_000 },
        )
        .toBe('ready');

      // ── 6. La pantalla del mesero se entera sola, sin recargar ───────────────────────
      // El botón de avance pasa a ofrecer «Entregada», que es la transición siguiente a `ready`.
      // Sirve de aserción doble: el estado llegó y la pantalla recalculó qué se puede hacer.
      await expect(mesero.getByRole('button', { name: 'Entregada' })).toBeVisible({
        timeout: 15_000,
      });

      // ── 7. Caja: turno, cobro y mesa libre ───────────────────────────────────────────
      await cajero.goto('/pos');
      await cajero.getByRole('button', { name: 'Abrir turno' }).click();

      // Dentro del diálogo, siempre: el disparador y el botón de confirmar se llaman igual, y
      // fuera de ese ámbito el localizador es ambiguo.
      const dialogo = cajero.getByRole('dialog');
      await dialogo.locator('input').first().fill('100');
      await dialogo.getByRole('button', { name: 'Abrir turno' }).click();

      // Con turno abierto, el disparador del encabezado pasa a mostrar el acumulado.
      await expect(cajero.getByRole('button', { name: /^Turno ·/ })).toBeVisible({
        timeout: 10_000,
      });
      await capturar(cajero, '04-caja');

      await cajero.goto(`/pos/${creada.id}`);
      await cajero.getByRole('button', { name: 'Efectivo', exact: true }).click();
      await cajero.getByRole('button', { name: /registrar pago/i }).click();

      await expect
        .poll(
          async () => {
            const [o] = await query<{ status: string }>(
              `SELECT status FROM orders WHERE id = $1`,
              [creada.id],
            );
            return o.status;
          },
          { timeout: 15_000 },
        )
        .toBe('closed');
      await capturar(cajero, '05-cobro');

      // Lo que ninguna pantalla enseña entera: el pago quedó atado al turno del cajero —sin eso
      // el arqueo no cuadra— y la mesa volvió a estar libre.
      const [pago] = await query<{ shift_id: string | null; amount: string }>(
        `SELECT shift_id, amount FROM payments ORDER BY processed_at DESC LIMIT 1`,
      );
      expect(pago.shift_id).not.toBeNull();
      expect(Number(pago.amount)).toBeCloseTo(220, 2);

      const [mesa] = await query<{ status: string }>(
        `SELECT t.status FROM tables t JOIN orders o ON o.table_id = t.id WHERE o.id = $1`,
        [creada.id],
      );
      expect(mesa.status).toBe('available');
    } finally {
      await salon.close();
      await cocina.close();
      await caja.close();
    }
  });
});
