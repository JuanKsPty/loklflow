import { expect, test } from '@playwright/test';
import { fixtures, installFakeApi } from './support/fake-api';
import { loginAs } from './support/session';

/**
 * El cascarón sin conexión.
 *
 * Se usa `context.setOffline(true)` y no la API falsa: aquí hace falta que **el origen entero**
 * sea inalcanzable, incluidos el documento y los chunks, que es lo único que ejercita al Service
 * Worker. Interceptar solo `/api` dejaría el HTML llegando por red y la prueba no probaría nada.
 *
 * El SW solo se registra con `NODE_ENV=production`, que es precisamente lo que sirve
 * `playwright.config.ts`: arranca el servidor standalone, el mismo que va dentro de la imagen.
 */
test.describe('Service Worker', () => {
  test('el manifiesto y el worker se sirven desde el mismo origen', async ({ page }) => {
    // Guarda el `COPY` de `public/` en el Dockerfile y el `cp` de la configuración: si
    // cualquiera de los dos desapareciera, el modo sin conexión se desplegaría roto sin que
    // nada más lo notara — con red la aplicación funciona exactamente igual.
    const sw = await page.request.get('/sw.js');
    expect(sw.ok()).toBe(true);
    expect(sw.headers()['content-type']).toContain('javascript');

    const manifest = await page.request.get('/manifest.webmanifest');
    expect(manifest.ok()).toBe(true);
    const parsed = (await manifest.json()) as { name: string; icons: unknown[]; start_url: string };
    expect(parsed.name).toBe('LoklFlow');
    expect(parsed.icons.length).toBeGreaterThan(0);

    // Los iconos que el manifiesto declara tienen que existir de verdad: un manifiesto con
    // iconos roluza la instalación en la pantalla de inicio sin decir por qué.
    const icon = await page.request.get('/icons/icon-192.png');
    expect(icon.ok()).toBe(true);
  });

  test('la página se registra y sirve el cascarón con el origen caído', async ({ page, context, baseURL }) => {
    const { handlers } = fixtures();
    await installFakeApi(page, handlers);
    await loginAs(context, baseURL!);

    await page.goto('/waiter');
    await expect(page.getByRole('heading', { name: 'Salón' })).toBeVisible();

    // El registro ocurre tras `load`, así que se espera a que el worker esté activo.
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));

    /**
     * **La primera visita no calienta la caché, y no es un defecto de la prueba.**
     *
     * El `fetch` del Service Worker solo intercepta lo que pasa por una página que él ya
     * controla, y en la carga que lo registra todavía no controla nada. Así que el documento se
     * guarda en la **segunda** navegación, no en la primera.
     *
     * Consecuencia real, que va escrita en `docs/OFFLINE.md`: una tablet recién configurada
     * necesita usar cada pantalla una vez con red antes de que esa pantalla abra sin ella.
     * Hasta entonces cae en la página de respaldo, que es el caso de la tercera prueba.
     */
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Salón' })).toBeVisible();

    // Ahora sí: se corta el origen entero —ni documento, ni chunks, ni API.
    await context.setOffline(true);
    await page.reload();

    // Sin Service Worker aquí saldría la página de error del navegador. Con él, la aplicación.
    await expect(page.getByRole('heading', { name: 'Salón' })).toBeVisible();
    await expect(page.locator('body')).not.toContainText('ERR_INTERNET_DISCONNECTED');

    await context.setOffline(false);
  });

  test('una pantalla nunca visitada cae en la página de respaldo, no en el error del navegador', async ({
    page,
    context,
    baseURL,
  }) => {
    const { handlers } = fixtures();
    await installFakeApi(page, handlers);
    await loginAs(context, baseURL!);

    await page.goto('/waiter');
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));

    await context.setOffline(true);
    // `/pos` no se visitó con red, así que su documento no está guardado.
    await page.goto('/pos');

    await expect(page.getByRole('heading', { name: 'Sin conexión' })).toBeVisible();
    await context.setOffline(false);
  });
});
