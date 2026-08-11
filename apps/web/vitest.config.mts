import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const alias = { '@': fileURLToPath(new URL('./src', import.meta.url)) };

/**
 * El arnés de tests de `apps/web`.
 *
 * Empezó por un solo archivo —la serialización previa al reporte de errores, el único trozo del
 * frontend con lógica de seguridad—, creció con la cola sin conexión y ahora abarca también
 * componentes.
 *
 * **Dos proyectos, y no un `environment` global.** Es la trampa concreta de este repo:
 * `outbox.ts` ramifica según exista `navigator.locks`, y jsdom trae `navigator` pero **no**
 * `locks`. Pasarlo todo a jsdom haría que los casos de `outbox.spec.ts` empezaran a probar en
 * silencio la otra rama —la de sin cerrojo entre pestañas— y seguirían en verde sin decir nada.
 * Así que `src/lib/**` corre en node, como hasta ahora, y solo los componentes en jsdom.
 */
export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'node',
          environment: 'node',
          // `.ts` solamente: lo que lleva JSX es de la otra mitad.
          include: ['src/**/*.spec.ts'],
          // Instala una IndexedDB de mentira para los specs de la cola. Va aquí y no en cada
          // spec porque `db.ts` la busca en el ámbito global al abrirse.
          setupFiles: ['./vitest.setup.ts'],
        },
      },
      {
        resolve: { alias },
        /**
         * `tsconfig.json` declara `"jsx": "preserve"` porque quien compila el JSX es Next.
         * Vite lee esa opción del tsconfig, así que sin esto deja el JSX intacto y el parser se
         * queda mirando un `<ButtonPrimitive` en mitad de un archivo que cree JavaScript.
         *
         * Va en `oxc` y no en `esbuild`: Vite 8 transforma con oxc, y la clave vieja se ignora
         * en silencio — que es lo que hace que el error parezca no tener arreglo.
         */
        oxc: { jsx: { runtime: 'automatic' } },
        test: {
          name: 'componentes',
          environment: 'jsdom',
          include: ['src/**/*.spec.tsx'],
          setupFiles: ['./vitest.setup.dom.ts'],
        },
      },
    ],
  },
});
