# Auditoría de seguridad

Revisión sobre el OWASP Top 10 (2021): qué hace el código hoy, el archivo que lo demuestra, y el
**riesgo residual** con la decisión que hay detrás.

El contexto importa para leer las decisiones: el servidor vive **dentro del establecimiento**, hay
**una sola instancia**, los usuarios son empleados con tablets compartidas, y el sistema es una caja
registradora — **dejar a todo el salón fuera a mitad de servicio es un fallo peor que casi
cualquier otro**. Varias decisiones de abajo se explican solo con eso.

---

## Resumen

| | Estado |
|---|---|
| A01 Control de acceso | Cubierto, con revocación efectiva |
| A02 Fallos criptográficos | Cubierto |
| A03 Inyección | Cubierto |
| A04 Diseño inseguro | Cubierto en los flujos de dinero |
| A05 Configuración incorrecta | Cubierto; CSP en modo informe |
| A06 Componentes vulnerables | Parcial: sin escaneo automático |
| A07 Identificación y autenticación | Cubierto |
| A08 Integridad de datos y software | Parcial |
| A09 Registro y monitorización | Cubierto |
| A10 SSRF | No aplica |

---

## A01 · Control de acceso roto

**Deny by default.** `JwtAuthGuard` y `PermissionsGuard` son `APP_GUARD` globales
(`app.module.ts`), así que una ruta sin `@RequirePermissions` ni `@Public()` no es accesible por
descuido. Cubierto por `guards.int-spec.ts`.

**Toda la superficie anónima está en un archivo.** `apps/api/src/public/public.controller.ts`, más
`/api/health`, `/api/ready`, las tres rutas de `auth` y la lista del PIN pad. La pregunta «¿qué
alcanza alguien sin sesión?» se responde leyendo eso.

**La revocación funciona.** Era el agujero más grave: `PermissionsGuard` lee los permisos **del
token**, así que desactivar a un empleado o cambiarle el rol no tenía efecto hasta que caducara —
cuatro horas en una sesión por PIN, doce en su token de refresco. `users.token_version`
(`token-version/token-version.cache.ts`) se firma en el token y se compara en cada petición; subirla
invalida todas las sesiones del usuario. Sube al desactivar, al cambiar de rol y al cambiar los
permisos de un rol.

**Los identificadores no son capacidades.** El seguimiento del pedido de un cliente no recibe
ningún id: sale de un pase firmado que caduca en 4 h (`public/guest-token.ts`). El uuid de una orden
aparece en eventos de socket, en URLs de recibo y lo elige el propio dispositivo para la cola sin
conexión; usarlo como llave de lectura habría convertido cualquier filtración en un acceso
permanente.

> **Riesgo residual.** `TokenVersionCache` **falla en abierto**: si Postgres no responde se sirve el
> último valor cacheado y, si no lo hay, se acepta el token. Una sesión revocada sobrevive mientras
> dure la caída. Es deliberado: la alternativa es que un parpadeo de la base eche al salón entero a
> mitad de servicio. Se registra un `warn` cada vez que ocurre.

> **Riesgo residual.** La caché tiene 30 s de TTL. La invalidación es inmediata para los cambios
> hechos por la aplicación —el escritor tira la entrada—, pero un `UPDATE` a mano o el seed tardan
> hasta 30 s en surtir efecto.

---

## A02 · Fallos criptográficos

- **bcrypt con coste 10** para contraseñas y PINs (`users.service.ts`, `auth.service.ts`).
- **Cookies `httpOnly` + `secure` en producción + `sameSite: 'strict'`**, con los mismos atributos
  al poner y al **borrar** — se corrigió: el `clearCookie` los omitía, y varios navegadores cotejan
  el conjunto al invalidar, así que la sesión podía sobrevivir al cierre.
- **Los secretos no tienen valor por defecto.** `jwt.config.ts` lanza al arrancar si falta
  `JWT_SECRET`/`JWT_REFRESH_SECRET` o si siguen con el valor de ejemplo.
- **El pase de invitado usa un secreto derivado** por HMAC de `JWT_SECRET` con una etiqueta
  versionada: quien pueda firmar un pase no puede firmar una sesión, sin añadir una variable de
  entorno más que pueda faltar.
- **Nada de credenciales en logs.** `database.config.ts` mantiene `logging` apagado a propósito
  —`logQueryError` de TypeORM incluye los parámetros enlazados, y un insert fallido en `users`
  dejaría el hash del PIN en `docker logs`—, `HttpExceptionFilter` describe la excepción campo a
  campo y omite `detail`, y `audit-redact.ts` tacha credenciales antes de persistir.
- **`report.ts`** en el front es la única costura hacia un log y recorta y tacha lo que tenga forma
  de JWT.

> **Riesgo residual.** `sameSite: 'strict'` cubre CSRF razonablemente y no hay tokens CSRF. Con la
> topología de un solo origen y sin formularios cross-site, es suficiente; con un tercer origen
> habría que revisarlo.

---

## A03 · Inyección

**Cero interpolación de cadenas en SQL.** Los 16 constructores de consulta de `reports.service.ts`
usan parámetros nombrados; las únicas `.query()` de servicios son literales estáticos (`nextval`,
`SELECT 1`). Las que llevan interpolación están en migraciones (DDL fijo) y en el arnés de tests.

**Validación global estricta.** `ValidationPipe({ whitelist, transform, forbidNonWhitelisted })`,
cubierto por `validation.int-spec.ts`. Es lo que hace que las omisiones deliberadas de los DTOs
públicos —que un cliente no pueda mandar `id`, `source` o `tableId`— sean **aplicadas** y no
documentales.

**XSS**: React escapa por defecto y no hay ningún `dangerouslySetInnerHTML` en el repo.

---

## A04 · Diseño inseguro

Las reglas que protegen dinero viven en el servidor, no en la interfaz:

- **Una cuenta no se cierra con saldo** (`orders.service.ts`). La UI pintaba un botón por cada
  transición permitida, y un toque sacaba la cuenta de «por cobrar» liberando la mesa sin haber
  cobrado.
- **Un turno abierto por cajero**, garantizado por un índice parcial único: la comprobación del
  servicio es un *read-then-write* y un doble clic abría dos turnos, dejando el arqueo sin sentido.
- **Idempotencia real** en creación de órdenes, ítems y pagos, comprobando **antes** de escribir:
  `save()` con una clave primaria existente hace `UPDATE`, así que confiar en la violación de
  unicidad habría sobrescrito la orden en silencio.
- **La cola sin conexión se niega a diferir dinero** (`queueable.ts`): cobrar, propina, descuento y
  turno exigen conexión. Ver `docs/OFFLINE.md`.
- **La fusión de cuentas rechaza las que tienen pagos, descuento o propina**, con lo que los dos
  casos difíciles no ocurren en lugar de resolverse a medias.
- **El pedido por QR** tiene controles de dominio que pesan más que el límite de peticiones: la mesa
  tiene que estar recibiendo pedidos, hay tope de pedidos vivos por mesa, y las cantidades están
  acotadas en el DTO — un `{ quantity: 999999 }` es una petición bien formada que ningún límite de
  tasa atrapa.

---

## A05 · Configuración incorrecta

- **helmet** en la API, con `frameguard: deny`, `noSniff`, `hsts`, `referrerPolicy` y sin
  `X-Powered-By` (`security.int-spec.ts`).
- **Cabeceras y CSP en el front** (`lib/security-headers.ts`, 11 casos de spec).
- **CORS validado al arrancar**, en una función pura compartida por `main.ts` y el gateway: eran dos
  copias, y el gateway no puede inyectar `ConfigService` porque se evalúa dentro de un decorador.
- **Swagger apagado en producción** (`main.ts`).
- **Las migraciones no corren al arrancar**: son un paso explícito, para que dos instancias no
  compitan por el mismo `ALTER TABLE`.

> **Riesgo residual — el más importante de este documento.** El **CSP va en `Report-Only`**. Una
> directiva de menos rompe el tiempo real o el Service Worker sin ningún error de red, así que se
> observa antes de obligar. El paso a obligatorio está planificado detrás de una prueba e2e que
> afirme cero violaciones en las cinco pantallas.

> **Riesgo residual.** `style-src` conserva `'unsafe-inline'`. Un nonce rompería
> `global-error.tsx`, cuyos estilos van en línea precisamente porque una causa de llegar ahí es que
> la hoja no haya cargado. `script-src` también lo conserva por los scripts de arranque de Next.

> **Riesgo residual.** `main.ts` no configura `trust proxy`, así que detrás de Traefik la IP que ven
> el límite de peticiones y la bitácora es la del proxy. En un local con una sola IP pública apenas
> cambia nada —el límite de sesión ya se cuenta por `(ip, usuario)` y el público por `(ip, mesa)`—
> pero conviene saberlo antes de leer una IP de la bitácora como si fuera la del cliente.

---

## A06 · Componentes vulnerables

Dependencias al día y CI que construye ambas imágenes en cada PR.

> **Riesgo residual.** No hay escaneo automático de vulnerabilidades (`pnpm audit`, Dependabot o
> equivalente) en el pipeline. Es la carencia más clara de esta sección.

---

## A07 · Identificación y autenticación

Era la sección más débil y es donde más ha cambiado.

- **Límite de peticiones** en `/auth/login`, `/auth/pin` y `/auth/refresh`, contado por
  `(ip, usuario)` y **no globalmente**: todo el tráfico de lectura sale de la IP del proceso de
  Next, y un límite global estrangularía el local entero.
- **Bloqueo por intentos fallidos** (`login-attempts.service.ts`): cinco fallos bloquean un minuto,
  doblando hasta quince. Sin él, diez intentos por minuto recorren las 10 000 combinaciones de un
  PIN de cuatro dígitos en unas 17 horas.
- **La respuesta de una cuenta bloqueada es idéntica** a la de una credencial incorrecta, con el
  mensaje exacto de esa vía. Un 423 o un mensaje distinto sería un oráculo y diría cuándo volver.
- **Política de PIN** (`pin-policy.ts`): fuera repeticiones, secuencias, líneas del teclado y los
  más usados — contra esos el bloqueo no ayuda, porque no hace falta insistir.
- **Rotación de tokens de refresco** con revocación, `jti` único por emisión, y **tope de cinco
  vivos por usuario**: la tabla crecía sin límite y cada fila es una sesión reactivable.
- **Las sesiones por PIN tienen refresco propio** (12 h) — antes caducaban a las 4 h sin forma de
  renovarse y dejaban al operario en un formulario de email donde no tiene credenciales.

> **Riesgo residual.** El bloqueo vive **en memoria**: se pierde al reiniciar el proceso. Una
> columna sería una escritura por intento fallido en la ruta más caliente; y un reinicio no lo puede
> provocar quien está probando.

> **Riesgo residual.** La lista del PIN pad es **pública** (nombres y roles del personal activo).
> Cerrarla obligaría a teclear un uuid, y esa información es visible para cualquiera que se acerque
> a la barra: ocultarla sería seguridad por oscuridad. La defensa real es el bloqueo.

> **Riesgo residual.** **No hay segundo factor.** Para una caja con tablets compartidas y acceso por
> PIN es una decisión de producto, no un descuido.

---

## A08 · Integridad de datos y software

- **La bitácora registra 21 acciones** con valor anterior y posterior, redactando credenciales.
- **`order_status_history`** conserva cada transición, ahora con la hora del hecho además de la del
  registro.
- **Las imágenes se construyen desde la raíz del monorepo** con lockfile, y CI arranca ambas y
  comprueba salud, un 401 en ruta protegida, los estáticos, `/sw.js` y el manifiesto.

> **Riesgo residual.** Las imágenes no se firman ni se genera SBOM.

> **Riesgo residual.** El pedido público **no tiene clave de idempotencia**: el DTO rechaza a
> propósito que un cliente elija identificadores. Un doble toque está cubierto en la interfaz con
> una guarda de envío en curso; un reintento a nivel de red podría duplicar un pedido. Es visible
> para el mesero y para el propio cliente, y a diferencia de un pago no mueve dinero.

---

## A09 · Registro y monitorización

- **Log estructurado en JSON**, una línea un objeto, con `requestId` en cada una
  (`common/logging/`). CI lo verifica **sobre la imagen en marcha**, que es la única forma.
- **El id de petición nace en un middleware del módulo**, no en `main.ts`: los guards resuelven
  antes que cualquier interceptor, así que faltaría justo en los 401 y 403. Un `x-request-id`
  entrante solo se acepta si encaja en `/^[A-Za-z0-9_.:-]{8,64}$/` — sin comprobarlo se pueden
  fabricar líneas de log falsas con saltos de línea.
- **`/api/ready`** consulta la base con caché y una sola comprobación en vuelo; `/api/health` no la
  toca, para que un parpadeo no reinicie un contenedor sano.
- **Los rechazos del gateway van deduplicados** por origen: una tablet olvidada con el token
  caducado escribiría decenas de miles de líneas por noche.
- **`auth.login_failed` y `auth.login_locked`** quedan en la bitácora, visibles en `/admin/audit`.

> **Riesgo residual.** No hay alertas: los logs se leen a mano. Para un solo local es asumible;
> para varios, no.

---

## A10 · SSRF

No aplica: el servidor no hace peticiones a URLs que controle el usuario. El único campo con forma
de URL es `business_config.logo_url`, que se **renderiza** en el cliente y nunca se pide desde el
servidor.

---

## Cómo se comprueba

```bash
pnpm --filter=api test                 # incluye pin-policy, cors, login-attempts
pnpm --filter=api test:int             # guards, validation, security, throttler, public
pnpm --filter=web test                 # security-headers, proxy
pnpm --filter=web test:e2e             # ruta protegida sin sesión, cabeceras
```

Los archivos que sostienen este documento:

| Área | Archivo |
|---|---|
| Guards y deny-by-default | `common/guards/guards.int-spec.ts` |
| Validación estricta | `common/validation.int-spec.ts` |
| Cabeceras de la API | `common/security.int-spec.ts` |
| Cabeceras y CSP del front | `web/src/lib/security-headers.spec.ts` |
| Bloqueo, poda, revocación, roster | `auth/security.int-spec.ts` |
| Límite de peticiones | `auth/throttler.int-spec.ts` |
| Superficie pública | `public/public.int-spec.ts` |
| Pase de invitado | `public/guest-token.spec.ts` |
| Política de PIN | `users/pin-policy.spec.ts` |
| CORS | `config/cors.spec.ts` |
| Redacción de la bitácora | `audit/audit-redact.spec.ts` |
