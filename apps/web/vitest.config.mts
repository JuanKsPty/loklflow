import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * El primer arnés de tests de `apps/web`, que hasta ahora no tenía ninguno.
 *
 * Entra en el bloque 2 y no en el 3 por un solo archivo: la serialización previa al reporte
 * de errores. Es el único trozo del frontend con lógica de seguridad —decide qué sale hacia
 * un log y qué no— y son funciones puras, sin React ni navegador, así que probarlas cuesta
 * nada. El resto del arnés (fake-indexeddb para la cola, Playwright contra el build de
 * producción) llega con el núcleo offline.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
});
