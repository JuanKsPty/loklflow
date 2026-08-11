import { useSyncExternalStore } from 'react';

const MOBILE_BREAKPOINT = 768;
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

/**
 * Ancho de pantalla, leído con `useSyncExternalStore` y no con `useState` + efecto.
 *
 * La versión anterior escribía el estado dentro del efecto de montaje, que es lo que avisa
 * `react-hooks/set-state-in-effect`: provoca un render en cascada y, sobre todo, **el primer
 * render devuelve siempre `false`** aunque el dispositivo sea un móvil. Con `useSyncExternalStore`
 * el valor es correcto desde la primera pintura en el cliente, y el `getServerSnapshot` fija qué
 * ve el servidor sin inventarse un tamaño de pantalla que no puede conocer.
 */
function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    // En el servidor no hay ventana. `false` mantiene el comportamiento previo —la maqueta de
    // escritorio— y evita un desajuste de hidratación distinto en cada render.
    () => false,
  );
}
