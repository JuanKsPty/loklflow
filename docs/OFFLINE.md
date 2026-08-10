# El modo sin conexión

Cómo LoklFlow sigue funcionando cuando se cae el WiFi, qué deja de funcionar a propósito, y
por qué.

El sistema está pensado para un servidor **dentro** del establecimiento, así que «sin
conexión» casi nunca significa «internet caído»: significa una tablet que se aleja del punto de
acceso, un switch reiniciado, un router encendido con la línea muerta. Cortes de segundos o
minutos, en medio de un servicio, con gente esperando.

---

## 1. La regla que decide todo

> **Se difiere lo que solo describe lo que ya pasó en el salón. No se difiere nada que mueva
> dinero o que dependa de un estado que este dispositivo no puede conocer.**

La tabla vive en [`apps/web/src/lib/offline/queueable.ts`](../apps/web/src/lib/offline/queueable.ts)
y su spec obliga a que toda operación nueva declare de qué lado está, con un motivo escrito para
que lo lea un operario.

| Operación | ¿Se difiere? | Por qué |
|---|---|---|
| Abrir cuenta | ✅ | Es un hecho del salón. El id lo acuña el dispositivo |
| Añadir / cambiar / quitar un producto | ✅ | Ídem. Fijar una cantidad a N es idempotente |
| Estado de comanda: `preparing`, `ready`, `delivered` | ✅ | Describen trabajo ya hecho |
| Estado de comanda: `closed`, `cancelled` | ❌ | Cerrar mueve dinero; cancelar libera la mesa y anula algo que la cocina pudo empezar |
| Estado de una línea | ✅ | Lo mismo que el de la comanda |
| Estado de mesa: `occupied`, `cleaning`, `available` | ✅ | Con desempate por hora del hecho (§5) |
| Estado de mesa: `reserved`, `maintenance` | ❌ | Dependen de lo que sepan los demás dispositivos |
| **Cobrar** | ❌ | Exige el total real de la cuenta, que puede haber cambiado. Cobrar contra un total viejo deja al cajero con el cajón cuadrado y la cuenta abierta |
| Propina | ❌ | Cambia el total de una cuenta que se está cobrando |
| Descuento | ❌ | Necesita la aprobación de un rol con umbral suficiente, en línea |
| Abrir / cerrar turno | ❌ | Un índice de la base garantiza un solo turno abierto por cajero, y el arqueo tiene que contar todo lo cobrado |

Cuando algo no diferible se intenta sin red, la pantalla enseña **el motivo**, no un «Error».

---

## 2. La vida de una operación

```
toque del operario
   → orders.offline.ts / tables.offline.ts   (acuñan la clave de idempotencia)
   → mutate()
       ├── el servidor contestó 2xx      → 'sent'
       ├── el servidor contestó 4xx/5xx  → se relanza: ya decidió, no se encola
       ├── el fetch rechazó y es diferible → 'queued' (a IndexedDB)
       └── el fetch rechazó y NO es diferible → 'rejected' con su motivo
```

Las claves de idempotencia se acuñan en **un solo sitio**: `withOrderIds` / `withItemId` en
[`orders.api.ts`](../apps/web/src/lib/api/orders.api.ts) y `withRequestId` en
[`payments.api.ts`](../apps/web/src/lib/api/payments.api.ts). El transporte diferido compone
esos mismos helpers; dos sitios que acuñaran claves acabarían divergiendo, y el síntoma sería una
comanda duplicada meses después.

El id de una cuenta se acuña **antes** de intentar el envío, y por eso una comanda abierta sin
red ya tiene identidad y se puede navegar a ella.

---

## 3. La cola

[`apps/web/src/lib/offline/outbox.ts`](../apps/web/src/lib/offline/outbox.ts), sobre Dexie.

- **FIFO por partición, no global.** Todo lo de una cuenta va a `order:<id>` y todo lo de una
  mesa a `table:<id>`. Dentro de una partición el orden es sagrado —«añadir ítem» no puede
  adelantar a «crear la comanda»— y entre particiones se avanza en paralelo, así que una cuenta
  atascada no deja sin enviar al resto del salón.
- **El orden lo asigna la base**, con la clave autoincremental `seq`. `Date.now()` no sirve: un
  mesero que toca rápido encola varias operaciones dentro del mismo milisegundo, y calcularlo en
  el cliente deja la misma carrera entre dos pestañas.
- **Retroceso exponencial**: `min(1000 · 2^intentos, 300 000)` ms, medido desde el último
  intento. Ocho intentos como máximo.
- **Un solo drenador**, con cerrojo de dos capas: una bandera de módulo para la misma pestaña y
  `navigator.locks` para dos pestañas de la misma tablet. Sin `navigator.locks` se drena sin el
  cerrojo entre pestañas, a la vista y no en silencio.

### Terminalidad

| Respuesta | Qué se hace |
|---|---|
| 2xx | Enviada, sale de la cola |
| **404 en un DELETE** | **Enviada.** Quitar algo que ya no está es el resultado buscado |
| **401 · 403** | **Se detiene el drenado entero.** No es culpa de la operación, es la sesión: se queda pendiente, sin gastar intentos, y el indicador pide volver a entrar |
| **408 · 425 · 429** | Se reintenta. El 429 importa: la ráfaga de reconexión de una tablet con veinte operaciones lo dispararía, y darlo por definitivo sería perder comandas por defenderse de un ataque que nadie estaba haciendo |
| Resto de 4xx | Definitivo → bandeja de fallos |
| 5xx y fallos de red | Se reintenta; la partición se detiene para no romper el orden |
| 8 intentos agotados | Bandeja de fallos |

**Nada se descarta en silencio, nunca.**

---

## 4. Reconexión

Tres detectores, de más fiable a menos:

1. **El resultado de las peticiones reales** ([`lib/api/reachability.ts`](../apps/web/src/lib/api/reachability.ts)).
   No es una opinión sobre la red: es lo que le pasó a la petición que alguien acaba de hacer.
   Vive en la capa HTTP para que **toda** petición la alimente, no solo las diferibles.
2. **La sonda** a `/api/health`, al montar, al volver el evento `online` y al volver la pestaña a
   primer plano. Va a `/health` y **no** a `/ready` a propósito: `ready` consulta la base, así que
   una base caída se leería como «no hay red» y la cola dejaría de enviar con el camino
   perfectamente bien.
3. **`navigator.onLine`**, solo por su `false`. Su `true` no significa nada: lo devuelve con el
   router encendido y la línea muerta, que es el caso más común aquí.

El intervalo de sondeo es de **15 s**, y ese número es el peor caso para volver a enviar: cuando
la red se recupera en silencio, ese temporizador es el único que se entera, así que su periodo es
literalmente el tiempo que una comanda sigue existiendo solo en una tablet.

Todo esto lo orquesta [`OfflineProvider`](../apps/web/src/components/offline/offline-provider.tsx),
montado en los tres layouts operativos y **no** en el raíz: `/login` y `/pin` no deben sondear ni
drenar una cola con una sesión que todavía no existe.

---

## 5. Conflictos

La cola reproduce **hechos**, no fusiona **estado**. No hay mezcla campo a campo porque nada
diferible lleva un valor que dos dispositivos puedan editar a la vez, y el orden dentro de una
cuenta lo garantiza `seq`. El servidor manda: un replay nunca reescribe estado que no pudo ver.

Los conflictos alcanzables, que son pocos porque el diseño los evita en lugar de resolverlos:

| Situación | Qué pasa |
|---|---|
| Se añade un producto a una cuenta que la caja ya cerró | El servidor responde 400 → bandeja de fallos con su mensaje. Es el conflicto canónico |
| Transición de estado que ya no es legal | 400 → bandeja |
| La comanda ya estaba en ese estado | El servidor responde 200 sin hacer nada: naturalmente idempotente |
| Se quita una línea que ya no está | 404 en DELETE → enviada, sin ruido |
| **Dos dispositivos cambian el estado de la misma mesa** | Gana el hecho más reciente, no el que llegue más tarde. El servidor compara el `occurredAt` de la operación con `tables.status_changed_at` y **descarta la vieja con un 200**, sin emitir evento: nadie debe encontrarse una entrada en la bandeja por el color de una mesa |
| La sesión caduca durante el corte | El drenado se detiene entero y el indicador lo dice. No se pierde nada |
| Se cierra sesión con la cola llena | Se avisa antes: lo pendiente se enviaría con la cookie del **siguiente** usuario, y `waiterId` y `changed_by` quedarían atribuidos a otro en la bitácora y en el reporte por mesero |

### La bandeja de fallos

Un panel lateral que se abre desde el indicador de la cabecera, así que existe igual en mesero,
cocina y caja. Agrupada **por cuenta**, porque es como piensa quien la lee: nadie quiere
reintentar «PATCH /orders/…/items/…», quiere reintentar la mesa 4. Reintentar actúa sobre la
partición entera —una operación sola cuyas anteriores siguen fallando va contra el mismo muro— y
conserva el `seq`, así que el orden se mantiene. Descartar exige confirmación que nombra lo que se
tira y **deja rastro** en el log.

---

## 6. La hora del hecho

Cada operación viaja con `occurredAt`: la hora a la que ocurrió en el salón, no la del envío.

Sin ella, una comanda tomada a las 21:40 y sincronizada a las 22:05 queda fechada a las 22:05, y
`order_status_history` y el reporte de tiempos de preparación miden **cuándo volvió la red**: un
corte de veinte minutos infla veinte minutos el tiempo de cocina de todas las órdenes del corte.

El servidor la declara en los seis DTOs que una operación diferible puede alcanzar y la guarda en
`orders.occurred_at` y `order_status_history.occurred_at` — columnas **nuevas**, no un reemplazo
de `created_at`, porque el rastro debe conservar los dos hechos: cuándo pasó y cuándo nos
enteramos.

`saneOccurredAt` **recorta en vez de rechazar**: un reloj imposible se descarta y se usa la hora
del servidor. Una tablet con la fecha mal puesta no puede costar una comanda.

> Declararla no era opcional. El pipe global corre con `forbidNonWhitelisted`, así que hasta que
> los DTOs la aceptaron, **toda** operación reenviada recibía un 400 y acababa en la bandeja.

---

## 7. Lectura sin conexión

Las ocho rutas operativas eran Server Components con `cache: 'no-store'`: sin servidor no
renderizaban. Ahora el patrón es **cascarón de servidor + vista de cliente**:

1. La ruta conserva su `serverFetch` y pasa lo que trajo como `initial`.
2. La vista lo siembra en el almacén `cache` de IndexedDB y **lee de ahí** por `useLiveQuery`.
3. Superpone las operaciones pendientes, así que lo encolado se ve aplicado.
4. Se refresca con `api.get` **en cliente** ante eventos de socket, escribiendo en la copia.

Cuando `serverFetch` falla, `initial` llega como `null` y la pantalla arranca con lo último que
supo. El aviso de «sin conexión» solo aparece si además la copia está vacía.

Dos reglas que no son obvias:

- **`replaceCollection` protege lo que tiene operaciones en cola.** Una cuenta abierta sin red
  existe en el dispositivo y **no** en la respuesta del servidor; sin protegerla, el siguiente
  refresco del listado la borraría —comanda incluida— mientras la cola seguiría enviando
  operaciones contra algo invisible.
- **El precio no se reconstruye desde la cola.** Abrir cuenta y añadir producto necesitan nombre y
  precio del catálogo, que solo tiene la pantalla que los eligió: escriben su fila optimista en el
  momento, con los mismos ids que van en la operación. Reconstruirlo en la superposición sería
  inventarse un precio.

`router.refresh()` no se usa en estas rutas: reejecuta el Server Component —que sin red falla— y
resiembra la pantalla con el `initial` viejo.

---

## 8. El Service Worker

[`apps/web/public/sw.js`](../apps/web/public/sw.js). Su único trabajo es el **cascarón**: HTML,
CSS y chunks. Los datos son cosa de IndexedDB.

- **Filtra por path, no por origen.** En producción la API vive detrás del mismo dominio (Traefik
  reparte `/api` y `/socket.io` al backend y el resto al front), así que el
  `url.origin !== self.location.origin` de todos los ejemplos funcionaría en desarrollo y **no
  filtraría nada en producción**: acabarían en caché respuestas autenticadas en una tablet
  compartida. Esta es la regla que sostiene la seguridad.
- **Nunca guarda una respuesta redirigida.** `proxy.ts` responde 307 a `/login` sin cookie, y esa
  respuesta en caché enviaría al login a un mesero con sesión válida para siempre.
- `_next/static` va cache-first: lleva hash de contenido, es inmutable y se calienta solo.
- Las navegaciones de `/waiter`, `/kitchen` y `/pos` van network-first con el documento guardado
  como respaldo, conservando la URL para que el enrutado de Next siga mandando.
- **Sin `skipWaiting`**: una tablet aguanta un servicio entero sin recargar, y cambiar los chunks
  bajo una página viva da `Failed to fetch dynamically imported module` en cuanto alguien abre un
  diálogo — parece una caída y ocurre con gente esperando.

> `public/` no viaja dentro de la salida standalone. El `COPY` del Dockerfile, el `cp` de
> `playwright.config.ts` y la comprobación del job `images` de CI son las tres cosas que impiden
> que el modo sin conexión se despliegue roto **sin que nada falle de forma visible**: con red la
> aplicación funciona exactamente igual.

---

## 9. Límites conocidos

Escritos porque son decisiones, no descuidos:

- **No se cobra sin red.** Ni propina, ni descuento, ni abrir o cerrar turno.
- **El arqueo solo cuenta lo enviado.** Por eso cerrar turno no se difiere: firmar una diferencia
  con operaciones sin enviar es firmar una diferencia falsa.
- **Una tablet recién configurada necesita visitar cada pantalla una vez con red.** El `fetch` del
  Service Worker solo intercepta lo que pasa por una página que ya controla, y en la carga que lo
  registra todavía no controla nada. Hasta entonces, esa pantalla cae en `/offline`.
- **Sin `orderNumber` hasta sincronizar.** Viene de una secuencia de Postgres; adivinarlo daría dos
  comandas con el mismo número. La interfaz usa la mesa o la etiqueta mientras tanto.
- **El total de una cuenta con pendientes es orientativo.** Descuento y propina nunca se difieren,
  así que vienen del servidor; el subtotal se recalcula en el dispositivo. El bueno lo fija el
  servidor al sincronizar, y la caja avisa antes de cobrar una cuenta con pendientes.
- **Una sesión caducada detiene la cola** hasta que alguien vuelva a entrar.
- **Cerrar sesión con la cola llena avisa**, pero no lo impide del todo: a veces hay que salir.
- **Sin IndexedDB no hay modo sin conexión** (Safari en privado, algunos WebView de kiosco). La
  aplicación funciona con red igual que siempre.

---

## 10. Probarlo a mano

```bash
docker compose up -d postgres
pnpm dev
```

1. Abre `/waiter` con red y navega por el salón, una mesa y una comanda. Recarga cada pantalla una
   vez si quieres el cascarón guardado (necesita el build de producción: en `dev` el Service
   Worker no se registra a propósito).
2. Para la API: `Ctrl-C` en el proceso de `apps/api`, o `docker compose stop postgres` si quieres
   simular solo la base caída.
3. Comprueba que el salón, la mesa y la comanda siguen renderizando.
4. Marca una comanda lista: aparece «Sin enviar» y el indicador de la cabecera cambia.
5. Recarga la pantalla. Sigue ahí.
6. Arranca la API. En 15 s como máximo el indicador se limpia solo.

Con el cascarón, sobre el build de producción:

```bash
pnpm --filter=web build
pnpm --filter=web test:e2e            # las seis pruebas de corte y reconexión
```

> En desarrollo, si un Service Worker de un build anterior se queda pegado sirviendo chunks
> viejos: *Application → Service Workers → Unregister* en las herramientas del navegador. Los
> errores que produce parecen del código y no lo son.

---

## 11. Dónde está cada cosa

| Archivo | Qué es |
|---|---|
| `lib/offline/queueable.ts` | La tabla de decisión. El archivo más importante |
| `lib/offline/outbox.ts` | La cola: orden, retroceso, terminalidad, bandeja |
| `lib/offline/mutate.ts` | El punto único por el que pasan las mutaciones diferibles |
| `lib/offline/net.ts` | Sonda y detección de reconexión |
| `lib/offline/cache.ts` | La copia local de lo que contó el servidor |
| `lib/offline/apply-pending.ts` | Superposición de la cola sobre la copia |
| `lib/offline/optimistic.ts` | Lo que la superposición no puede reconstruir: precios |
| `lib/api/reachability.ts` | La señal de conectividad, alimentada por cada petición |
| `lib/api/orders.offline.ts`, `tables.offline.ts` | El transporte que sabe diferir |
| `components/offline/*` | Proveedor, indicador, bandeja, marca de pendiente, registro del SW |
| `components/realtime/realtime-invalidator.tsx` | Refresco por socket que escribe en la copia |
| `public/sw.js` | El cascarón |
| `e2e/offline-sync.spec.ts`, `e2e/service-worker.spec.ts` | Las pruebas del ciclo completo |
