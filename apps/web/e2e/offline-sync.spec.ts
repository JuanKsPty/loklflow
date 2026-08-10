import { expect, test } from '@playwright/test';
import { fixtures, installFakeApi } from './support/fake-api';
import { loginAs } from './support/session';

/**
 * El corte y la reconexión, en un navegador de verdad.
 *
 * Es la prueba que el roadmap pide y la que ningún test unitario puede dar: aquí intervienen
 * IndexedDB real, el ciclo de vida de React, la hidratación y `fetch`. Los specs de `outbox` y
 * `mutate` comprueban las reglas; esto comprueba que el conjunto se comporta como un producto.
 */
test.describe('sincronización tras un corte', () => {
  test('lo que se toca sin red se ve aplicado, sobrevive a una recarga y se envía una sola vez', async ({
    page,
    context,
    baseURL,
  }) => {
    const { handlers, order } = fixtures();
    const api = await installFakeApi(page, handlers);
    await loginAs(context, baseURL!);

    // 1. En línea: la cuenta se pinta y se siembra en la copia local del dispositivo.
    await page.goto(`/waiter/orden/${order.id}`);
    await expect(page.getByRole('heading', { name: `Orden #${order.orderNumber}` })).toBeVisible();

    // 2. Se corta la red. `abort('failed')` hace que `fetch` rechace, que es la única forma de
    //    producir un OfflineError real: un 503 sería una respuesta del servidor.
    api.goOffline();

    // 3. El mesero marca la comanda lista. La operación es encolable por diseño.
    await page.getByRole('button', { name: 'Lista' }).click();

    // Se ve aplicada: es la superposición de la cola sobre la copia local. Sin ella el mesero
    // volvería a tocar el botón creyendo que no funcionó.
    await expect(page.getByText('Sin enviar').first()).toBeVisible();

    // 4. **Recarga estando todavía sin red.** Es el requisito de verdad del roadmap: la
    //    persistencia tiene que sobrevivir al cierre de la pestaña, no solo al render.
    await page.reload();
    await expect(page.getByRole('heading', { name: `Orden #${order.orderNumber}` })).toBeVisible();
    await expect(page.getByText('Sin enviar').first()).toBeVisible();

    // 5. Vuelve la red. El proveedor sondea y drena solo.
    api.goOnline();

    await expect
      // El peor caso para enterarse de que la red volvió es el intervalo de sondeo de
      // `onBackOnline` (15 s): aquí nadie toca nada ni el navegador emite `online`, así que ese
      // temporizador es el único disparador. El margen lo cubre con holgura.
      .poll(() => api.writes().filter((c) => c.path.includes('/status')).length, {
        timeout: 30_000,
      })
      .toBe(1);

    const [replay] = api.writes().filter((c) => c.path.includes('/status'));
    expect(replay.method).toBe('PATCH');
    expect(replay.path).toContain(`/orders/${order.id}/status`);
    expect(replay.body).toMatchObject({ status: 'ready' });
    // La hora del hecho viaja: sin ella el informe de tiempos de preparación mediría cuándo
    // volvió el WiFi en lugar de cuánto tardó la cocina.
    expect(typeof replay.body?.occurredAt).toBe('string');

    // Y la cola queda limpia.
    await expect(page.getByText('Sin enviar')).toHaveCount(0);
  });

  /**
   * La barandilla del dinero, vista desde el navegador.
   *
   * Un cobro **nunca** se difiere: el total real de la cuenta puede haber cambiado desde otro
   * dispositivo, y cobrar contra un total viejo deja al cajero con el cajón cuadrado y la cuenta
   * abierta. Lo que se comprueba aquí es lo que de verdad importa: que el intento fallido no
   * acabe en la cola disfrazado de trabajo pendiente, y que la caja pase a decir que no se puede
   * cobrar en vez de seguir ofreciéndolo.
   */
  test('un cobro sin red falla a la vista y no se queda en la cola', async ({
    page,
    context,
    baseURL,
  }) => {
    const { handlers, order } = fixtures();
    const api = await installFakeApi(page, handlers);
    await loginAs(context, baseURL!, {
      permissions: ['pos:read', 'pos:create', 'orders:read', 'orders:update'],
    });

    await page.goto(`/pos/${order.id}`);
    await expect(page.getByRole('heading', { name: `Cuenta #${order.orderNumber}` })).toBeVisible();

    api.goOffline();
    await page.getByRole('button', { name: /Registrar pago|Cobrar/i }).first().click();

    // El cajero se entera en el momento, no cuando cuadra la caja.
    await expect(page.getByText(/No hay conexión con el servidor/i)).toBeVisible();

    // Y en cuanto el intento falla, la señal de conectividad lo sabe: el panel de cobro se
    // retira y explica el motivo, en vez de invitar a un segundo intento igual de inútil.
    await expect(page.getByText('Sin conexión: no se puede cobrar')).toBeVisible();

    // Lo importante: **nada** en la cola. Un cobro encolado sería dinero que la caja cree
    // cobrado y el servidor no conoce.
    await page.getByRole('button', { name: /Sincronización/ }).click();
    await expect(page.getByText('Todo enviado')).toBeVisible();
  });
});

test.describe('conflictos', () => {
  test('lo que el servidor rechaza acaba en la bandeja, con su motivo, y se puede descartar', async ({
    page,
    context,
    baseURL,
  }) => {
    const { handlers, order } = fixtures();
    const api = await installFakeApi(page, handlers);
    await loginAs(context, baseURL!);

    await page.goto(`/waiter/orden/${order.id}`);
    await expect(page.getByRole('heading', { name: `Orden #${order.orderNumber}` })).toBeVisible();

    api.goOffline();
    await page.getByRole('button', { name: 'Lista' }).click();
    await expect(page.getByText('Sin enviar').first()).toBeVisible();

    // La cuenta se cerró desde la caja durante el corte: al reconectar, el servidor rechaza el
    // cambio de estado. Es el conflicto canónico de este diseño.
    api.failNext('/status', 400, 'Transición no permitida: closed → ready');
    api.goOnline();

    // El indicador de la cabecera pasa a rojo y la bandeja explica qué pasó.
    await page.getByRole('button', { name: /Sincronización/ }).click();
    await expect(page.getByText('Transición no permitida: closed → ready')).toBeVisible({
      timeout: 30_000,
    });

    // Descartar exige confirmación que nombra lo que se tira: es la única acción de la
    // aplicación que destruye trabajo del salón.
    await page.getByRole('button', { name: 'Descartar' }).first().click();
    await expect(page.getByRole('heading', { name: /¿Descartar/ })).toBeVisible();
    await page.getByRole('button', { name: 'Descartar', exact: true }).last().click();

    await expect(page.getByText('Transición no permitida: closed → ready')).toHaveCount(0);
  });
});
