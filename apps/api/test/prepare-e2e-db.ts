/**
 * Prepara la base de datos del e2e y sale.
 *
 * Es el mismo `global-setup` de los tests de integración —crear la base si falta, aplicar las
 * migraciones, vaciar y sembrar— apuntando a **otra** base. Se ejecuta desde el `webServer` de
 * Playwright, encadenado antes de arrancar la API, porque Playwright levanta los servidores
 * *antes* de su propio `globalSetup` y la API se cae al arrancar si la base no existe.
 *
 * `TEST_DATABASE_NAME` la elige quien invoca; el script de `package.json` fija `loklflow_e2e`.
 * **No se reutiliza `loklflow_test`**: la suite de integración la trunca entera, así que un
 * `pnpm test:int` corriendo a la vez que un e2e haría fallar a los dos sin causa visible.
 */
import globalSetup from './global-setup';

globalSetup()
  .then(() => {
    console.log(`[e2e] base ${process.env.TEST_DATABASE_NAME} lista`);
    process.exit(0);
  })
  .catch((err) => {
    console.error('[e2e] no se pudo preparar la base:', err);
    process.exit(1);
  });
