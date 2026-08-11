'use client';

import { useEffect } from 'react';

/**
 * Registra el Service Worker.
 *
 * Va en el layout **raíz**, no en los operativos, y esa es la única decisión de este archivo:
 * el cascarón tiene que empezar a guardarse desde la primera visita —incluida `/login`, que es
 * por donde entra todo el mundo—, o una tablet recién configurada se queda sin nada guardado
 * hasta que alguien navegue a `/waiter` con red.
 *
 * No se registra en desarrollo. Un SW sirviendo chunks viejos sobre un `next dev` con recarga
 * en caliente produce errores que parecen del código y no lo son, y se tarda media hora en
 * caer en que la causa era este archivo.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    // Tras `load`: registrar durante la carga inicial compite por ancho de banda con los
    // recursos que la pantalla necesita para pintarse.
    const register = () => {
      void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        // Un fallo aquí no puede tumbar la aplicación: sin Service Worker se pierde el
        // cascarón sin conexión, pero la cola y la copia local siguen funcionando enteras.
      });
    };

    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });

    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
