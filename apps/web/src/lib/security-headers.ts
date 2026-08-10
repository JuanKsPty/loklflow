/**
 * Las cabeceras de seguridad del front.
 *
 * En un módulo aparte de `next.config.ts` para poder probarlas: el CSP es una cadena larga donde
 * una directiva de menos rompe el tiempo real y una de más no protege nada, y ninguna de las dos
 * cosas falla de forma visible en desarrollo.
 */

export interface HeaderPair {
  key: string;
  value: string;
}

/**
 * El origen de la API, tal y como lo va a contactar el **navegador**.
 *
 * En producción es el mismo dominio que el front —Traefik reparte `/api` y `/socket.io` al
 * backend—, así que `connect-src 'self'` bastaría. En desarrollo son puertos distintos, y ahí hay
 * que nombrarlo. Se deriva de la variable en vez de escribirlo, que es lo que hace que el CSP
 * funcione en los dos sitios sin tener dos versiones.
 */
function apiOrigins(apiUrl: string | undefined): string[] {
  if (!apiUrl) return [];
  try {
    const { origin, host, protocol } = new URL(apiUrl);
    // El socket abre `ws://` o `wss://` contra el mismo host, y **`connect-src` no deriva un
    // esquema del otro**: sin esta línea el tiempo real deja de funcionar sin un solo error de
    // red, solo una violación de CSP en la consola. Es el fallo más probable de todo el bloque.
    const ws = `${protocol === 'https:' ? 'wss:' : 'ws:'}//${host}`;
    return [origin, ws];
  } catch {
    return [];
  }
}

export function contentSecurityPolicy(
  env: { NEXT_PUBLIC_API_URL?: string; NODE_ENV?: string } = process.env,
): string {
  const isDev = env.NODE_ENV !== 'production';
  const connect = ["'self'", ...apiOrigins(env.NEXT_PUBLIC_API_URL)];

  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'base-uri': ["'self'"],
    'object-src': ["'none'"],
    'frame-ancestors': ["'none'"],
    'form-action': ["'self'"],
    // `data:` para los iconos en línea; `blob:` para el SVG del QR cuando se descarga.
    'img-src': ["'self'", 'data:', 'blob:'],
    /**
     * `'self'` basta para las fuentes: `next/font` **auto-hospeda** Geist en el build, así que no
     * hay ninguna petición a `fonts.gstatic.com`. Es la línea que casi todos los ejemplos de CSP
     * para Next traen de más.
     */
    'font-src': ["'self'", 'data:'],
    /**
     * `'unsafe-inline'` en estilos es inevitable, y un nonce está descartado: Next inyecta un
     * `<style>` en línea con las variables de fuente, y sobre todo `global-error.tsx` lleva sus
     * estilos en línea **a propósito** —una de las causas posibles de llegar a esa pantalla es que
     * la hoja no haya cargado—. Un nonce rompería justo el archivo cuya razón de existir es
     * funcionar cuando lo demás no funciona.
     */
    'style-src': ["'self'", "'unsafe-inline'"],
    'script-src': [
      "'self'",
      "'unsafe-inline'",
      // `unsafe-eval` solo en desarrollo: lo necesita la recarga en caliente de Next. En
      // producción no aparece.
      ...(isDev ? ["'unsafe-eval'"] : []),
    ],
    'connect-src': connect,
    // El Service Worker se registra desde el mismo origen; `blob:` porque alguna herramienta de
    // desarrollo crea workers así.
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
  };

  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ');
}

/**
 * Las cabeceras que se sirven en todas las rutas.
 *
 * El CSP va en **`Report-Only`** por ahora. No es indecisión: una directiva de menos rompe el
 * tiempo real o el Service Worker sin ningún error de red —solo una línea en una consola que nadie
 * mira— y el modo informe permite comprobarlo con una prueba automática antes de que pueda romper
 * nada. El paso a obligatorio es el último commit del proyecto, detrás de un e2e que afirma **cero
 * violaciones** en las cinco pantallas.
 */
export function securityHeaders(
  env: { NEXT_PUBLIC_API_URL?: string; NODE_ENV?: string } = process.env,
  { enforceCsp = false }: { enforceCsp?: boolean } = {},
): HeaderPair[] {
  const headers: HeaderPair[] = [
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    // La aplicación no usa ninguna de las tres. Declararlo impide que un script inyectado sí lo
    // haga, y en una tablet compartida de un local eso importa más que en un portátil.
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    {
      key: enforceCsp ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only',
      value: contentSecurityPolicy(env),
    },
  ];

  /**
   * HSTS solo en producción, y aun así con una nota: el servidor vive **dentro** del local y se
   * puede acceder por IP y HTTP desde la red interna. La cabecera es inerte sobre HTTP —los
   * navegadores la ignoran si no llega por TLS—, así que no rompe ese caso; sirve para el dominio
   * público, que sí va por HTTPS.
   */
  if (env.NODE_ENV === 'production') {
    headers.push({
      key: 'Strict-Transport-Security',
      value: 'max-age=31536000; includeSubDomains',
    });
  }

  return headers;
}
