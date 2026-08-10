'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { flush, onReachability } from '@/lib/offline/mutate';
import { onBackOnline, probe } from '@/lib/offline/net';

/**
 * Quien decide si hay servidor al otro lado, y quien vacía la cola cuando lo hay.
 *
 * Se monta **dentro de las tres superficies operativas** —mesero, cocina y caja— y no en el
 * layout raíz. `/login` y `/pin` no deben sondear cada treinta segundos ni intentar drenar una
 * cola con una sesión que todavía no existe, y el panel de administración es una superficie de
 * escritorio que sin servidor no tiene nada que enseñar.
 *
 * El estado se alimenta de tres fuentes, en orden de fiabilidad:
 *
 * 1. **El resultado de las mutaciones reales** (`onReachability`). Es la mejor de largo: no es
 *    una opinión sobre la red, es lo que le pasó a la petición que acaba de hacer el mesero.
 * 2. **La sonda contra `/api/health`**, al montar, al volver el evento `online` y al volver la
 *    pestaña a primer plano.
 * 3. **`navigator.onLine`**, suscrito con `useSyncExternalStore` y usado solo por su `false`:
 *    cuando dice que sí miente con el router encendido y la línea caída, que es el caso que
 *    esto viene a cubrir. Su valor se **multiplica** con el de la sonda, no lo reemplaza.
 *
 * El contador de pendientes **no** viaja por aquí: lo leen los hooks de Dexie directamente, que
 * es lo que los hace reactivos entre pestañas. Meterlo en el contexto lo congelaría en el valor
 * que hubiera al montar, y un contador congelado en una caja es una diferencia de arqueo.
 */

export interface Connectivity {
  online: boolean;
  /** Hay un drenado en marcha. Sirve para no disparar dos y para pintar el indicador. */
  syncing: boolean;
  /** Cuándo terminó el último drenado con éxito. `null` si aún no hubo ninguno. */
  lastSyncAt: number | null;
  /**
   * La cola está parada porque la sesión no vale. No es un fallo de las operaciones: siguen
   * pendientes y se enviarán en cuanto alguien vuelva a entrar.
   */
  needsAuth: boolean;
  /** Fuerza un intento ahora mismo. Lo llama el botón de la bandeja. */
  flushNow: () => Promise<void>;
}

const ConnectivityContext = createContext<Connectivity | null>(null);

/**
 * Lo que opina el navegador, suscrito como lo que es: una fuente externa.
 *
 * Con `useSyncExternalStore` en vez de sembrar el estado dentro de un efecto, que es lo que
 * pedía a gritos este caso: React se encarga de que el render del servidor —donde no hay
 * `navigator`— y el del cliente no discrepen, sin un render intermedio con el valor equivocado.
 *
 * Su `true` no significa nada (lo devuelve con el router encendido y la línea caída); su
 * `false` es información fiable y gratis.
 */
function subscribeToBrowserOnline(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

const browserOnline = () => navigator.onLine !== false;
// En el servidor se asume que sí: es lo que hará el cliente en cuanto hidrate, salvo que el
// navegador diga lo contrario, y así el primer pintado no parpadea.
const browserOnlineOnServer = () => true;

export function useConnectivity(): Connectivity {
  const value = useContext(ConnectivityContext);
  if (!value) {
    throw new Error('useConnectivity necesita un <OfflineProvider> por encima');
  }
  return value;
}

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const browserSaysOnline = useSyncExternalStore(
    subscribeToBrowserOnline,
    browserOnline,
    browserOnlineOnServer,
  );
  /**
   * Lo que dicen la sonda y las peticiones reales. Empieza en `true` porque lo contrario sería
   * pintar «sin conexión» durante el primer segundo de cada carga, y el mesero que ve eso al
   * abrir la aplicación deja de creerse el indicador.
   */
  const [serverReachable, setServerReachable] = useState(true);
  // La conjunción no es redundante: el navegador detecta la caída del WiFi al instante y
  // gratis, mientras que la sonda tarda hasta el siguiente intervalo.
  const online = browserSaysOnline && serverReachable;
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  // Evita dos drenados solapados sin depender del estado, que llega un render tarde.
  const draining = useRef(false);

  const flushNow = useCallback(async () => {
    if (draining.current) return;
    draining.current = true;
    setSyncing(true);
    try {
      const result = await flush();
      setNeedsAuth(result.needsAuth);
      // Solo cuenta como sincronización si de verdad se movió algo: marcar la hora en cada
      // latido haría que el indicador dijera «al día» con la cola llena.
      if (result.sent > 0) setLastSyncAt(Date.now());
      if (result.sent > 0 || result.failed > 0) setServerReachable(true);
    } catch {
      // `flush` ya distingue lo reintentable de lo terminal y deja rastro por su cuenta. Aquí
      // solo hay que no tumbar el árbol: esto es una caja registradora.
    } finally {
      draining.current = false;
      setSyncing(false);
    }
  }, []);

  /**
   * Al montar: una comprobación real —lo único que distingue «hay WiFi» de «llega al
   * servidor»— y, si hay camino, un vaciado. Lo más probable al abrir la pantalla es que haya
   * quedado algo de la sesión anterior.
   *
   * Las dos cosas van juntas y no en dos efectos: `flush()` sondea por su cuenta, así que
   * separarlas costaba dos peticiones a `/api/health` en cada carga de cada pantalla operativa.
   */
  useEffect(() => {
    void probe().then((reachable) => {
      setServerReachable(reachable);
      if (reachable) void flushNow();
    });
  }, [flushNow]);

  // La señal buena: lo que le pasó a una petición de verdad.
  useEffect(
    () =>
      onReachability((state) => {
        setServerReachable(state === 'reached');
        // Volvió el servidor y alguien lo descubrió tocando algo: aprovechar para vaciar.
        if (state === 'reached') void flushNow();
      }),
    [flushNow],
  );

  useEffect(() => {
    const stop = onBackOnline(() => {
      setServerReachable(true);
      void flushNow();
    });
    return stop;
  }, [flushNow]);

  /**
   * Una tablet que pasa el servicio con la pantalla apagada no recibe eventos ni ejecuta
   * temporizadores con fiabilidad. Al volver a mirarla hay que comprobar de verdad, o el
   * mesero ve «sin conexión» sobre una red que lleva media hora funcionando.
   */
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      void probe().then((reachable) => {
        setServerReachable(reachable);
        if (reachable) void flushNow();
      });
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [flushNow]);

  return (
    <ConnectivityContext.Provider
      value={{ online, syncing, lastSyncAt, needsAuth, flushNow }}
    >
      {children}
    </ConnectivityContext.Provider>
  );
}
