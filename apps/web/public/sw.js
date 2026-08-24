/* eslint-env serviceworker */

/**
 * El Service Worker de LoklFlow.
 *
 * Su único trabajo es que el **cascarón** de la aplicación exista sin red: el HTML, el CSS y
 * los chunks de JavaScript. Los datos no son cosa suya — de eso se ocupa la copia local en
 * IndexedDB, que además es la única capa donde se puede mezclar lo que la cola ya aplicó.
 *
 * Escrito a mano y no con `@serwist/next` a propósito: ese plugin envuelve `next.config.ts`,
 * que aquí carga `output: 'standalone'`, `outputFileTracingRoot` y el `dotenv` del que depende
 * la carga de entorno del monorepo entero. Es justo la pieza que rompe una imagen sin que nadie
 * lo note hasta que no arranca, y lo que hay debajo son estas ciento y pico líneas.
 *
 * Coste asumido: sin manifiesto de precarga generado en el build no se pueden precachear los
 * chunks por nombre. No hace falta — llevan hash de contenido, así que son inmutables y
 * `cache-first` con escritura al vuelo los calienta solos. Lo que sí implica es que **una
 * tablet que instala el SW y se queda sin red inmediatamente no tiene cascarón todavía**.
 */

const VERSION = 'v2';
const SHELL = `loklflow-shell-${VERSION}`;
const ASSETS = `loklflow-assets-${VERSION}`;
const OFFLINE_URL = '/offline';

/** Las tres superficies que tienen que abrir sin red. El resto no se guarda. */
const OPERATIONAL = [/^\/waiter(\/|$)/, /^\/kitchen(\/|$)/, /^\/pos(\/|$)/];

self.addEventListener('install', (event) => {
  // Solo la página de respaldo: es estática, no llama a `cookies()` y por tanto se puede
  // guardar sin que dependa de ninguna sesión.
  event.waitUntil(caches.open(SHELL).then((cache) => cache.add(OFFLINE_URL)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith('loklflow-') && !name.endsWith(VERSION))
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

/**
 * **No hay `skipWaiting`, y es deliberado.**
 *
 * Una tablet aguanta un servicio entero sin recargar. Cambiar los chunks bajo una página viva
 * produce `Failed to fetch dynamically imported module` en cuanto el mesero abre un diálogo,
 * que parece una caída de la aplicación y ocurre justo cuando hay gente esperando. El SW nuevo
 * espera a que se cierren las pestañas; la siguiente carga completa lo estrena.
 */

/** Nunca se guarda una respuesta que no sea un 200 propio del mismo origen. */
function isCacheable(response) {
  return (
    response &&
    response.ok &&
    response.status === 200 &&
    response.type !== 'opaqueredirect' &&
    !response.redirected
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Solo GET. Un POST guardado en caché sería una operación fantasma, y para diferir
  //    escrituras ya está la cola, que sabe cuáles se pueden diferir y cuáles no.
  if (request.method !== 'GET') return;

  // 2. **Filtrado por path, no por origen.** En producción la API vive detrás del mismo
  //    dominio: Traefik reparte `/api` y `/socket.io` al backend y el resto al front. Un
  //    `url.origin !== self.location.origin` funcionaría en desarrollo (:3000 contra :3001) y
  //    **no filtraría nada en producción**, con lo que acabarían en caché respuestas
  //    autenticadas en una tablet compartida. Esta es la regla que sostiene la seguridad; la
  //    del origen, de abajo, es solo refuerzo.
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/socket.io')) return;
  if (url.origin !== self.location.origin) return;

  // 3. Los estáticos de Next llevan hash de contenido: son inmutables, así que cache-first sin
  //    revalidar es correcto y es lo que calienta la caché sola.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, ASSETS));
    return;
  }

  // 4. Navegaciones de las pantallas operativas: red primero, con el documento guardado como
  //    respaldo. Se conserva la URL para que el enrutado de Next siga mandando, en vez de
  //    inventar aquí un enrutador propio.
  if (request.mode === 'navigate' && OPERATIONAL.some((re) => re.test(url.pathname))) {
    event.respondWith(networkFirstDocument(request));
    return;
  }

  // 5. El resto de navegaciones —`/`, `/login`, `/admin`, el recibo— **no se guardan**, y esa
  //    decisión no cambia: son superficies que sin servidor no tienen nada que enseñar, y una
  //    copia vieja del panel enseñaría las ventas de ayer con la misma cara que las de hoy. En un
  //    panel de gestión eso no es «degradado», es mentira, y el usuario no tiene forma de notarlo.
  //
  //    Lo que sí se les da es la página de respaldo cuando la red falla. Hasta ahora caían en el
  //    error del navegador —el dinosaurio—, que no dice nada y parece que la aplicación murió.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(SHELL);
        return (await cache.match(OFFLINE_URL)) ?? Response.error();
      }),
    );
  }
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;

  const response = await fetch(request);
  if (isCacheable(response)) cache.put(request, response.clone());
  return response;
}

async function networkFirstDocument(request) {
  const cache = await caches.open(SHELL);
  try {
    const response = await fetch(request);
    /**
     * **Nunca guardar una redirección.** `proxy.ts` responde 307 hacia `/login` cuando falta la
     * cookie. Si esa respuesta acabara en caché, un mesero con sesión válida sería enviado al
     * login desde la caché para siempre, y ningún reinicio lo arreglaría.
     */
    if (isCacheable(response)) cache.put(request, response.clone());
    return response;
  } catch {
    // El documento exacto que se pidió; si nunca se visitó, la página de respaldo.
    const hit = await cache.match(request);
    if (hit) return hit;
    const offline = await cache.match(OFFLINE_URL);
    if (offline) return offline;
    throw new Error('sin red y sin cascarón guardado');
  }
}
