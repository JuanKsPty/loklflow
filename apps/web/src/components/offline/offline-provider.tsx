'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { flush, onReachability } from '@/lib/offline/mutate';
import { isProbablyOnline, onBackOnline, probe } from '@/lib/offline/net';

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
 * 2. **La sonda contra `/api/health`**, periódica y al volver el evento `online`.
 * 3. **`navigator.onLine`**, solo para la semilla y solo cuando dice que no: cuando dice que sí
 *    miente con el router encendido y la línea caída, que es el caso que esto viene a cubrir.
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

export function useConnectivity(): Connectivity {
  const value = useContext(ConnectivityContext);
  if (!value) {
    throw new Error('useConnectivity necesita un <OfflineProvider> por encima');
  }
  return value;
}

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [online, setOnline] = useState(true);
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
      if (result.sent > 0 || result.failed > 0) setOnline(true);
    } catch {
      // `flush` ya distingue lo reintentable de lo terminal y deja rastro por su cuenta. Aquí
      // solo hay que no tumbar el árbol: esto es una caja registradora.
    } finally {
      draining.current = false;
      setSyncing(false);
    }
  }, []);

  // La semilla se hace en un efecto y no en `useState(isProbablyOnline())` porque el servidor
  // no tiene `navigator`: hacerlo en el render daría una hidratación distinta a la del cliente.
  useEffect(() => {
    setOnline(isProbablyOnline());
    void probe().then(setOnline);
  }, []);

  // La señal buena: lo que le pasó a una petición de verdad.
  useEffect(
    () =>
      onReachability((state) => {
        setOnline(state === 'reached');
        // Volvió el servidor y alguien lo descubrió tocando algo: aprovechar para vaciar.
        if (state === 'reached') void flushNow();
      }),
    [flushNow],
  );

  useEffect(() => {
    const stop = onBackOnline(() => {
      setOnline(true);
      void flushNow();
    });
    return stop;
  }, [flushNow]);

  // El navegador avisa de la caída al instante y gratis. Su `false` sí es información.
  useEffect(() => {
    const goOffline = () => setOnline(false);
    window.addEventListener('offline', goOffline);
    return () => window.removeEventListener('offline', goOffline);
  }, []);

  /**
   * Una tablet que pasa el servicio con la pantalla apagada no recibe eventos ni ejecuta
   * temporizadores con fiabilidad. Al volver a mirarla hay que comprobar de verdad, o el
   * mesero ve «sin conexión» sobre una red que lleva media hora funcionando.
   */
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      void probe().then((reachable) => {
        setOnline(reachable);
        if (reachable) void flushNow();
      });
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [flushNow]);

  // Un intento al montar: lo más probable al abrir la pantalla es que haya quedado algo de la
  // sesión anterior.
  useEffect(() => {
    void flushNow();
  }, [flushNow]);

  return (
    <ConnectivityContext.Provider
      value={{ online, syncing, lastSyncAt, needsAuth, flushNow }}
    >
      {children}
    </ConnectivityContext.Provider>
  );
}
