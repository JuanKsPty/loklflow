const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/**
 * Estado de conexión, entendido como «¿llega esto al servidor?» y no como «¿hay WiFi?».
 *
 * **`navigator.onLine` no basta y es la trampa clásica.** Devuelve `true` en cuanto hay una
 * interfaz de red activa, así que con el router encendido y sin línea —el caso más común en un
 * local, y precisamente el que este proyecto existe para sobrevivir— dice que hay conexión
 * mientras ninguna petición llega. Sirve para lo contrario: cuando dice `false`, es cierto.
 *
 * Por eso la única respuesta fiable es preguntarle al servidor. La sonda va contra
 * `/api/health`, que ya existe, es `@Public()` y a propósito no toca la base de datos: si la
 * base estuviera caída, `ready` diría que no y la cola dejaría de enviar cuando en realidad sí
 * hay camino. Aquí lo que se quiere saber es si el servidor contesta.
 */

const PROBE_TIMEOUT_MS = 4_000;

/** Lo barato: si dice que no hay red, no la hay. Si dice que sí, hay que comprobarlo. */
export function isProbablyOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

export async function probe(): Promise<boolean> {
  if (!isProbablyOnline()) return false;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}/api/health`, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    // Rechazo del fetch o corte por el temporizador. Las dos cosas significan lo mismo aquí.
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Avisa cuando la conexión vuelve. Devuelve la función para dejar de escuchar.
 *
 * Se escucha el evento `online` **y** se sondea con un intervalo, porque los dos disparadores
 * fallan en casos distintos: el evento no se emite cuando el WiFi nunca se cayó y lo que se
 * cortó fue la línea de arriba, y el intervalo solo gasta una petición pequeña cada tanto.
 *
 * El `connect` del socket queda fuera a propósito como disparador principal: si el token
 * caducó durante el corte —cuatro horas para una sesión por PIN—, `connect` no llega nunca.
 *
 * **El intervalo es el peor caso para volver a enviar.** Cuando la red se recupera en silencio
 * —el caso normal: alguien reinicia el router y nadie toca nada— este temporizador es el único
 * que se va a enterar, así que su periodo es literalmente el tiempo que una comanda sigue
 * existiendo solo en una tablet. Quince segundos son cuatro peticiones por minuto a un endpoint
 * que no toca la base de datos, contra las 12–18 que ya genera una sola acción humana con
 * varias pantallas abiertas: el coste no se nota y la ventana de riesgo se parte en dos.
 */
export function onBackOnline(callback: () => void, intervalMs = 15_000): () => void {
  if (typeof window === 'undefined') return () => undefined;

  let stopped = false;
  let checking = false;

  const check = async () => {
    // Una sonda en vuelo cada vez: con el intervalo corto y el servidor lento se
    // acumularían peticiones que no aportan nada.
    if (stopped || checking) return;
    checking = true;
    try {
      if (await probe()) callback();
    } finally {
      checking = false;
    }
  };

  window.addEventListener('online', check);
  const timer = setInterval(check, intervalMs);

  return () => {
    stopped = true;
    window.removeEventListener('online', check);
    clearInterval(timer);
  };
}
