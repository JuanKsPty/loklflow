import { expect, test } from '@playwright/test';
import { ROLES } from './support/roles';
import { resetOperationalData } from './support/db';

/**
 * Lo que la seguridad promete, comprobado en un navegador de verdad.
 *
 * Dos cosas que no se pueden verificar de ninguna otra forma:
 *
 * 1. **El bloqueo por intentos fallidos**, contra la API real, con el PIN correcto al final —
 *    porque lo que hay que demostrar es que ni siquiera el bueno entra mientras dura el bloqueo,
 *    y que la respuesta es la misma para los dos casos, sin oráculo.
 * 2. **Cero violaciones de CSP en consola** en las cinco pantallas. Es el gate que permite pasar
 *    la política de `Report-Only` a obligatoria: hacerlo sin esto es adivinar.
 */

test.describe('Seguridad', () => {
  test.describe('bloqueo por intentos fallidos', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('cinco PIN malos bloquean, y el sexto correcto tampoco entra', async ({ page }) => {
      await resetOperationalData();

      await page.goto('/pin');
      await page.getByText('Mesero Demo', { exact: true }).click();
      await page.waitForURL('**/pin/*');

      const teclear = async (pin: string) => {
        for (const d of pin) {
          await page.getByRole('button', { name: d, exact: true }).click();
        }
        await page.getByRole('button', { name: 'Confirmar' }).click();
        await expect(page.getByText(/PIN incorrecto/i).first()).toBeVisible({ timeout: 10_000 });
      };

      // Cinco fallos. `2847` es un PIN válido por formato y política, y no es el suyo.
      for (let i = 0; i < 5; i++) await teclear('2847');

      // El sexto es **el bueno**. No debe entrar: eso es el bloqueo haciendo su trabajo.
      await teclear('2846');
      await expect(page).toHaveURL(/\/pin\//);
    });
  });

  test.describe('cabeceras y política de contenido', () => {
    test.use({ storageState: ROLES.admin.file });

    test('el web declara sus cabeceras de seguridad', async ({ page }) => {
      const res = await page.goto('/admin');
      const headers = res!.headers();

      expect(headers['x-frame-options']).toBe('DENY');
      expect(headers['x-content-type-options']).toBe('nosniff');
      expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(headers['permissions-policy']).toContain('camera=()');
    });

    /**
     * El gate. Mientras esta lista esté vacía en las cinco pantallas, la CSP se puede pasar a
     * obligatoria; en cuanto deje de estarlo, obligarla dejaría la aplicación en blanco.
     */
    for (const ruta of ['/login', '/admin', '/waiter', '/pos', '/kitchen']) {
      test(`sin violaciones de CSP en ${ruta}`, async ({ page }) => {
        const violaciones: string[] = [];
        page.on('console', (msg) => {
          const texto = msg.text();
          if (/Content Security Policy|Refused to (load|execute|connect|apply)/i.test(texto)) {
            violaciones.push(texto);
          }
        });

        const res = await page.goto(ruta);
        // La cabecera tiene que estar: sin ella este test pasaría por no haber política ninguna.
        const csp =
          res!.headers()['content-security-policy-report-only'] ??
          res!.headers()['content-security-policy'];
        expect(csp, `${ruta} no declara CSP`).toBeTruthy();

        await page.waitForLoadState('networkidle');
        expect(violaciones, violaciones.join('\n')).toHaveLength(0);
      });
    }
  });

  test.describe('rutas protegidas', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    for (const ruta of ['/admin', '/waiter', '/pos', '/kitchen']) {
      test(`${ruta} rebota a /login sin sesión`, async ({ page }) => {
        await page.goto(ruta);
        await expect(page).toHaveURL(/\/login/);
      });
    }

    test('el menú público sí se abre sin sesión', async ({ page }) => {
      // La otra mitad de la misma regla: `PUBLIC_PREFIXES` existe para que `/m` no se trague
      // al invitado, y sin este caso una edición de `PROTECTED_PREFIXES` podría romperlo.
      const res = await page.goto('/m/codigo-que-no-existe');
      expect(res!.url()).not.toMatch(/\/login/);
    });
  });
});
