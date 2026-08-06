import { cookies } from 'next/headers';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ServerApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    /** El id que el servidor dio a esta petición. Es la llave para buscar su traza. */
    public readonly requestId?: string,
  ) {
    super(message);
    // Sin esto `name` se queda en `'Error'` heredado, y cualquier filtro o agrupación por
    // nombre —la de un reporte, la de un buscador de logs— mete estos errores en el mismo
    // saco que todos los demás.
    this.name = 'ServerApiError';
  }
}

/**
 * No se pudo hablar con la API desde el servidor de Next.
 *
 * El equivalente del `OfflineError` del navegador, que faltaba: aquí un `fetch` que rechaza
 * salía como `TypeError` en bruto, de modo que el renderizado del servidor **no podía
 * distinguir «la API no contesta» de «la API contestó 500»** — justo la distinción que el
 * cliente sí construyó. Y son cosas distintas: una la arregla mirar la red, la otra no.
 */
export class ServerOfflineError extends Error {
  constructor(
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'ServerOfflineError';
  }
}

/**
 * Distingue «el recurso no existe» de «no pudimos preguntar».
 *
 * Varias páginas llamaban a `notFound()` dentro del catch, así que con la API caída una mesa o
 * una cuenta que sí existen se mostraban como «página no encontrada»: información falsa sobre
 * datos reales. Solo un 404 del servidor significa de verdad que no está.
 */
export function isNotFound(err: unknown): boolean {
  return err instanceof ServerApiError && err.status === 404;
}

/** Si el fallo fue de red y no una respuesta del servidor. Cambia lo que se le dice al usuario. */
export function isOffline(err: unknown): boolean {
  return err instanceof ServerOfflineError;
}

export async function serverFetch<T>(path: string): Promise<T> {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api${path}`, {
      headers: token ? { Cookie: `access_token=${token}` } : {},
      cache: 'no-store',
    });
  } catch (err) {
    // `fetch` solo rechaza cuando la petición no llega a completarse. Cualquier respuesta,
    // incluido un 500, resuelve: por eso este es el único punto donde se puede separar.
    throw new ServerOfflineError(`La API no respondió (${path})`, { cause: err });
  }

  if (!res.ok) {
    throw new ServerApiError(
      res.status,
      `API error ${res.status} on ${path}`,
      res.headers.get('x-request-id') ?? undefined,
    );
  }
  return res.json() as Promise<T>;
}
