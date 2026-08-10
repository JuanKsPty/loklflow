import { expect, test } from '@playwright/test';

/**
 * Pruebas de humo del build de producción.
 *
 * Son pocas y modestas a propósito: hasta que exista el cascarón no hay nada sin conexión que
 * comprobar, y llenar esto de aserciones sobre la interfaz de hoy solo produciría tests que
 * hay que reescribir cada vez que cambia un texto. Lo que sí afirman es lo que se rompe en
 * silencio y solo se ve en un navegador de verdad.
 */

test('la aplicación arranca y sirve sus estilos', async ({ page }) => {
  await page.goto('/login');

  // Que la página cargue no dice nada del CSS: `.next/static` se copia en un paso aparte del
  // Dockerfile, y sin él la pantalla sale sin estilos pero con estado 200.
  const href = await page.locator('link[rel="stylesheet"]').first().getAttribute('href');
  expect(href).toBeTruthy();
  const css = await page.request.get(href!);
  expect(css.ok()).toBe(true);
});

test('una ruta que no existe da el 404 propio, en español', async ({ page }) => {
  const response = await page.goto('/esta-ruta-no-existe-jamas');

  expect(response?.status()).toBe(404);
  // El fallback de Next está en inglés y trae un `<style>` en línea que pisa el tema.
  await expect(page.getByText('Esto no existe')).toBeVisible();
  await expect(page.getByText('This page could not be found')).toHaveCount(0);
});

test('una ruta protegida sin sesión manda al login, no la enseña', async ({ page }) => {
  await page.goto('/waiter');

  await expect(page).toHaveURL(/\/login/);
});

/**
 * El navegador tiene que dar las dos piezas de las que depende todo el modo sin conexión.
 * Si el día de mañana la aplicación se sirviera por `http://` en una IP de LAN, `randomUUID`
 * desaparecería —solo existe en contexto seguro— y con él la clave primaria que el
 * dispositivo genera para poder trabajar aislado. Esto lo detectaría.
 */
test('el contexto del navegador soporta IndexedDB y uuid', async ({ page }) => {
  await page.goto('/login');

  const soporte = await page.evaluate(() => ({
    indexedDB: typeof indexedDB !== 'undefined',
    randomUUID: typeof crypto?.randomUUID === 'function',
    seguro: window.isSecureContext,
  }));

  expect(soporte).toEqual({ indexedDB: true, randomUUID: true, seguro: true });
});
