'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'loklflow:qr-base-url';

/**
 * La dirección que se codifica en los QR de las mesas.
 *
 * Por defecto es el origen desde el que se está mirando la pantalla, y ese default es
 * deliberadamente el bueno: un administrador que imprime las hojas lo hace desde la red del
 * local, así que su navegador **ya está** en la dirección que el teléfono de un cliente tiene
 * que poder abrir. La API no puede saberlo —ve `localhost:3001` o un nombre de contenedor—, y
 * una variable de entorno sería una cosa más que se configura mal en silencio.
 *
 * El único caso que rompe el default es el administrador trabajando en `localhost`, y para eso
 * el valor es editable y se recuerda: las hojas se imprimen más de una vez.
 *
 * Se lee con `useSyncExternalStore` y no sembrando estado en un efecto, porque es justo lo que
 * ese hook resuelve: en el servidor no hay `localStorage` ni `location`, y React se encarga de
 * que el render del servidor y el del cliente no discrepen sin un render intermedio con el valor
 * equivocado.
 */
export function useQrBaseUrl(): [string, (value: string) => void] {
  // Lo que el usuario acaba de escribir, si escribió algo en esta sesión de la pantalla.
  const [override, setOverride] = useState<string | null>(null);

  const stored = useSyncExternalStore(
    // Nada externo lo cambia mientras la página vive: quien lo edita es este mismo componente,
    // y para eso está `override`.
    noopSubscribe,
    readStored,
    // En el servidor se devuelve cadena vacía y el primer render del cliente la sustituye.
    readOnServer,
  );

  const set = useCallback((value: string) => {
    setOverride(value);
    window.localStorage.setItem(STORAGE_KEY, value);
  }, []);

  return [override ?? stored, set];
}

const noopSubscribe = () => () => undefined;
const readStored = () =>
  window.localStorage.getItem(STORAGE_KEY) ?? window.location.origin;
const readOnServer = () => '';

/** Quita las barras finales para que la URL no salga con `//m/`. */
export function qrUrlFor(baseUrl: string, qrCode: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/m/${qrCode}`;
}
