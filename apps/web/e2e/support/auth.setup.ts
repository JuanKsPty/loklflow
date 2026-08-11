import { mkdirSync } from 'node:fs';
import { expect, test as setup } from '@playwright/test';
import { AUTH_DIR, ROLES } from './roles';
import { resetOperationalData } from './db';

/**
 * Las sesiones del e2e, obtenidas **recorriendo el login de verdad**.
 *
 * Podría firmarse un token y meterlo en una cookie, como hace `session.ts` para las pruebas
 * herméticas. No se hace, y cuesta unos dos segundos por rol, porque así:
 *
 * - `/login` y `/pin/[userId]` quedan cubiertos, que si no serían las dos únicas pantallas del
 *   producto que nadie ejercita nunca;
 * - se guarda también el estado de zustand del `localStorage`, no solo la cookie — una sesión
 *   inyectada a mano deja la tienda vacía y media UI se comporta como si no hubiera usuario;
 * - y de paso se comprueba que cada rol aterriza donde trabaja, que es lógica de negocio
 *   (`lib/auth/landing.ts`) y no un detalle del arnés.
 */

setup.describe.configure({ mode: 'serial' });

setup('base limpia', async () => {
  // Antes que ninguna sesión: si un turno de caja quedó abierto de la ejecución anterior, el
  // spec de caja falla al abrir el suyo y el motivo no aparece por ningún lado.
  mkdirSync(AUTH_DIR, { recursive: true });
  await resetOperationalData();
});

setup('sesión de administrador por correo', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@loklflow.com');
  await page.getByLabel('Contraseña').fill('Admin1234!');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();

  await page.waitForURL('**/admin');
  await page.context().storageState({ path: ROLES.admin.file });
});

for (const [nombre, rol] of Object.entries(ROLES)) {
  const pin = rol.pin;
  if (!pin) continue;

  setup(`sesión de ${nombre} por PIN`, async ({ page }) => {
    await page.goto('/pin');

    // Se elige por el nombre que siembra el seed, no por posición: el roster va alfabético y
    // añadir un empleado lo cambiaría.
    await page.getByText(rol.perfil, { exact: true }).click();
    await page.waitForURL('**/pin/*');

    for (const digito of pin) {
      await page.getByRole('button', { name: digito, exact: true }).click();
    }
    await page.getByRole('button', { name: 'Confirmar' }).click();

    await page.waitForURL(`**${rol.landing}**`);
    await expect(page).toHaveURL(new RegExp(`${rol.landing}$`));
    await page.context().storageState({ path: rol.file });
  });
}
