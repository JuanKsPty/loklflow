import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

/**
 * jsdom no implementa `ResizeObserver`, y `input-otp` —el campo del PIN— lo instancia en un
 * efecto para seguir el ancho del contenedor. Sin él, montar el teclado revienta con un
 * `ReferenceError` que no tiene nada que ver con lo que se está probando.
 *
 * Es un doble inerte a propósito: no se afirma nada sobre el redimensionado.
 */
class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= NoopResizeObserver as unknown as typeof ResizeObserver;

/**
 * Desmonta lo renderizado entre casos.
 *
 * Sin esto, `screen.getByRole` busca sobre el `document` acumulado de todos los tests
 * anteriores del archivo y el segundo caso que renderice un botón falla por «varios
 * elementos» — un fallo que no habla de lo que se estaba probando.
 */
afterEach(cleanup);
