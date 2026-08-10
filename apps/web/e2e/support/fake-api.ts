import type { Page, Route } from '@playwright/test';

/**
 * Una API de mentira, interceptada en el navegador.
 *
 * **Por qué no se levanta la API de verdad aquí.** Necesitaría Postgres, migraciones, seed y
 * secretos, convirtiendo una suite de cuarenta segundos en minutos y acoplando las pruebas del
 * front a la base de datos. Y sobre todo: lo que hay que comprobar de la cola es *la petición
 * exacta que reproduce* —método, ruta, cuerpo, `occurredAt`, clave de idempotencia—, y eso se
 * afirma mejor con un grabador que consultando el estado final de una base. El flujo completo
 * contra la API real tiene su propia prueba en el bloque de e2e de servicio.
 *
 * **Trampa que hay que conocer**: `page.route` no intercepta las peticiones que hace un Service
 * Worker. Aquí no importa porque el SW sale temprano en `/api`, así que las llamadas a la API
 * salen de la página directamente. Si esa regla cambiara, estas pruebas se pondrían verdes sin
 * afirmar nada — que es la peor forma de fallar.
 */

export interface Recorded {
  method: string;
  url: string;
  path: string;
  body: Record<string, unknown> | null;
  /** La petición se cortó simulando falta de red: **el servidor nunca la vio**. */
  aborted: boolean;
}

export interface FakeApi {
  /** Todo lo que la página pidió a la API, en orden. */
  readonly calls: Recorded[];
  /**
   * Las escrituras que **llegaron** al servidor.
   *
   * Excluye las abortadas a propósito: si contaran, un intento fallido durante el corte y su
   * reenvío posterior darían dos, y la aserción «se envió exactamente una vez» pasaría por el
   * motivo contrario al que dice.
   */
  writes(): Recorded[];
  callsTo(pathFragment: string): Recorded[];
  goOffline(): void;
  goOnline(): void;
  /** Responde con este estado a la siguiente escritura que encaje. */
  failNext(pathFragment: string, status: number, message?: string): void;
}

type Handler = (path: string, method: string, body: Record<string, unknown> | null) => unknown;

export async function installFakeApi(
  page: Page,
  handlers: Record<string, Handler | unknown>,
): Promise<FakeApi> {
  const calls: Recorded[] = [];
  let offline = false;
  const failures: { fragment: string; status: number; message: string }[] = [];

  const api: FakeApi = {
    calls,
    writes: () => calls.filter((c) => c.method !== 'GET' && !c.aborted),
    callsTo: (fragment) => calls.filter((c) => c.path.includes(fragment)),
    goOffline: () => {
      offline = true;
    },
    goOnline: () => {
      offline = false;
    },
    failNext: (fragment, status, message = 'rechazado por el servidor') => {
      failures.push({ fragment, status, message });
    },
  };

  await page.route('**/api/**', async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api/, '') + url.search;
    const method = request.method();

    let body: Record<string, unknown> | null = null;
    try {
      const raw = request.postData();
      body = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
    } catch {
      body = null;
    }

    // `route.abort('failed')` es lo que hace que `fetch` **rechace**, que es la única forma de
    // producir un `OfflineError` de verdad. Un 503 no serviría: el servidor habría contestado, y
    // la cola trata eso como una decisión del servidor, no como falta de red.
    //
    // `/health` cae aquí también, y por eso `probe()` devuelve falso: la aplicación entera se
    // cree sin conexión, que es exactamente lo que se quiere simular.
    if (offline) {
      calls.push({ method, url: request.url(), path, body, aborted: true });
      await route.abort('failed');
      return;
    }

    calls.push({ method, url: request.url(), path, body, aborted: false });

    const failureIndex = failures.findIndex((f) => path.includes(f.fragment));
    if (failureIndex >= 0 && method !== 'GET') {
      const [failure] = failures.splice(failureIndex, 1);
      await route.fulfill({
        status: failure.status,
        contentType: 'application/json',
        body: JSON.stringify({ statusCode: failure.status, message: failure.message }),
      });
      return;
    }

    // La ruta más específica que encaje gana, para que `/orders/x/items` no la atrape `/orders`.
    const key = Object.keys(handlers)
      .filter((k) => path.startsWith(k))
      .sort((a, b) => b.length - a.length)[0];

    if (!key) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
      return;
    }

    const handler = handlers[key];
    const payload = typeof handler === 'function' ? (handler as Handler)(path, method, body) : handler;

    await route.fulfill({
      status: method === 'POST' ? 201 : 200,
      contentType: 'application/json',
      body: JSON.stringify(payload ?? {}),
    });
  });

  return api;
}

/** Datos mínimos y coherentes para las pantallas del mesero. */
export function fixtures() {
  const product = {
    id: 'p1',
    name: 'Tacos al pastor',
    description: null,
    price: 120,
    imageUrl: null,
    categoryId: 'c1',
    station: 'kitchen',
    isActive: true,
    modifiers: [],
  };

  const table = {
    id: 't1',
    number: 4,
    sectorId: 's1',
    sector: { id: 's1', name: 'Terraza', isActive: true },
    capacity: 4,
    status: 'occupied',
    shape: 'square',
    positionX: 0,
    positionY: 0,
    qrCode: 'qr-1',
    isActive: true,
  };

  const order = {
    id: 'o1',
    orderNumber: 12,
    label: null,
    tableId: 't1',
    table,
    waiterId: null,
    shiftId: null,
    source: 'staff',
    status: 'preparing',
    notes: null,
    subtotal: 240,
    discountAmount: 0,
    tipAmount: 0,
    total: 240,
    mergedIntoOrderId: null,
    occurredAt: null,
    items: [
      {
        id: 'i1',
        productId: 'p1',
        product,
        quantity: 2,
        unitPrice: 120,
        subtotal: 240,
        notes: null,
        status: 'pending',
        modifiers: [],
        createdAt: new Date('2026-08-10T20:00:00.000Z').toISOString(),
      },
    ],
    statusHistory: [],
    payments: [],
    createdAt: new Date('2026-08-10T20:00:00.000Z').toISOString(),
    updatedAt: new Date('2026-08-10T20:00:00.000Z').toISOString(),
  };

  return {
    product,
    table,
    order,
    handlers: {
      '/health': { status: 'ok' },
      '/shifts/current': null,
      '/tables/sectors': [table.sector],
      '/tables': [table],
      '/orders': [order],
      [`/orders/${order.id}`]: order,
      '/menu/products': [product],
      '/menu/categories': [{ id: 'c1', name: 'Tacos', sortOrder: 0, isActive: true }],
      '/menu/modifiers': [],
      '/notifications': [],
    } as Record<string, unknown>,
  };
}
