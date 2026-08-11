# Demo de LoklFlow

Guion del recorrido de tres minutos, y cómo regenerar las imágenes.

## Por qué esto es un documento y no un vídeo en el repo

Un vídeo de tres minutos son decenas de megas que git guarda para siempre y que quedan
desactualizados en cuanto cambia una pantalla. Se graba, se sube fuera y se enlaza desde el
README; aquí queda el guion, que es lo que se puede versionar y revisar.

`docs/video/` está en `.gitignore` para poder trabajar el archivo en local sin comprometerlo.

## El guion es un test

El recorrido de abajo es, literalmente, `apps/web/e2e/servicio.spec.ts` en prosa. No es una
coincidencia: es lo que hace que el guion no mienta. Si una de estas pantallas deja de
comportarse así, el CI se pone rojo antes de que nadie grabe nada.

```bash
# Levanta la API y el web, siembra la base y recorre el flujo dejando las capturas
pnpm --filter=web build:e2e
E2E_CAPTURAS=1 pnpm --filter=web test:e2e:servicio -- --grep "Servicio completo"
```

Las capturas caen en `docs/images/` con el número del hito delante, así que se ordenan solas.
Para grabar el vídeo, el mismo comando con `--headed` y `--video=on`.

## Minutado

| Tiempo | Pantalla | Qué se ve | Captura |
|--------|----------|-----------|---------|
| 0:00 | `/pin` | Un mesero entra con su PIN de cuatro dígitos. Sin teclado, sin correo, sin contraseña | — |
| 0:15 | `/waiter` | El salón por sectores, con el estado de cada mesa en color. Se abre la mesa 1 | `01-salon.png` |
| 0:35 | `/waiter/nueva` | Se tocan productos para armar la comanda; el subtotal se actualiza en vivo | `02-comanda.png` |
| 0:55 | `/kitchen` | **En otra pantalla, sin recargar**, la comanda ya está en «Pendientes». Es el momento que hay que enseñar | `03-cocina.png` |
| 1:15 | `/kitchen` | Cocina la avanza a «En preparación» y luego a «Lista» | — |
| 1:25 | `/waiter/orden/…` | La pantalla del mesero se entera sola: el botón cambia a «Entregada» | — |
| 1:40 | `/pos` | El cajero abre turno con su fondo inicial. Sin turno abierto no se puede cobrar | `04-caja.png` |
| 2:00 | `/pos/…` | Cobro en efectivo. La cuenta se cierra y **la mesa vuelve a estar libre sola** | `05-cobro.png` |
| 2:20 | `/pos` | Cierre de turno: arqueo con ventas por método, efectivo esperado y diferencia | — |
| 2:40 | `/admin` | El panel del dueño, con las ventas del día ya reflejadas | — |

## Lo que vale la pena decir en voz alta

Tres cosas que no se ven en una captura y son la mitad del producto:

1. **La comanda llega a cocina sin recargar.** Es un socket con handshake autenticado, no un
   sondeo cada cinco segundos.
2. **Si se cae el WiFi, el mesero sigue trabajando.** Las comandas se guardan en el dispositivo
   y se envían solas al volver la red, en orden y sin duplicar. Lo que **no** se puede hacer sin
   red es cobrar: eso es una decisión, no una limitación (ver [`OFFLINE.md`](./OFFLINE.md)).
3. **Nada de esto se prueba a mano.** Este recorrido exacto corre en CI, en un navegador de
   verdad, contra el mismo build que se despliega.

## Credenciales de la demo

Las del seed de desarrollo (`pnpm --filter=api seed`), que **no** se usan en producción:

| Perfil | Acceso |
|--------|--------|
| Administrador | `admin@loklflow.com` / `Admin1234!` |
| Mesero Demo | PIN `2846` |
| Cocina Demo | PIN `9173` |
| Cajero Demo | PIN `5029` |

Los PIN cambiaron de `1234/5678/4321` cuando entró la política de PIN, que rechaza exactamente
esos: secuencias y repeticiones. Publicar una demo con las credenciales que el propio código
llama inaceptables no tenía defensa.
