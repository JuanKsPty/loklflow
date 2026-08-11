import { z } from 'zod';

/**
 * Zod, **sin compilador JIT**.
 *
 * Zod 4 acelera la validación generando código con `new Function(...)`. Es rápido y es
 * exactamente lo que una Content-Security-Policy sin `'unsafe-eval'` prohíbe: el navegador lo
 * bloqueaba en `/login` con «Evaluating a string as JavaScript violates the following Content
 * Security Policy directive». Lo detectó el gate de consola de `e2e/seguridad.spec.ts`, que
 * existe para esto — en `Report-Only` la validación seguía funcionando y no se notaba nada, así
 * que al pasar la política a obligatoria **el formulario de acceso habría dejado de validar**.
 *
 * `jitless: true` es la opción que Zod trae para entornos con CSP estricta: mismos esquemas,
 * mismos errores, interpretado en vez de compilado. El coste es irrelevante aquí — se validan
 * formularios de ocho campos, no lotes de millones de filas.
 *
 * Se llama en el ámbito del módulo y **todos los esquemas importan `z` de aquí**, no de `zod`
 * directamente: la configuración tiene que estar puesta antes de que se construya el primer
 * esquema, y un esquema se construye al importarse su archivo.
 */
z.config({ jitless: true });

export { z };
