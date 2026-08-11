import { expect, test } from '@playwright/test';
import { ROLES } from './support/roles';

/**
 * Que nada se desborde a lo ancho en un teléfono.
 *
 * Es la única parte de «responsive» que se puede automatizar sin que el test se convierta en una
 * captura que alguien mira: un desbordamiento horizontal es objetivo y se detecta comparando el
 * ancho del contenido con el de la ventana.
 *
 * Corre en el proyecto `movil` (Pixel 7, 390×844), que es el tamaño real donde el mesero trabaja.
 *
 * Lo que **no** se afirma: que las tablas de `/admin` quepan. Quince componentes usan `ui/table`,
 * que envuelve en `overflow-x-auto` y por tanto no se rompe, solo se desplaza **dentro de su
 * propio contenedor**. Esa decisión está escrita en `design-system.md`; aquí se comprueba que el
 * desplazamiento se quede dentro y no arrastre a la página entera, que es lo que sí es un fallo.
 */

/**
 * `tactil` marca las pantallas de **servicio**, que se usan de pie y con el dedo.
 *
 * Las de administración no lo llevan a propósito, y no es una excepción de conveniencia: el
 * tamaño `touch` se **añadió** al sistema de diseño en vez de reemplazar a los compactos,
 * precisamente porque `/admin` se usa con ratón y agrandarlo todo destrozaría maquetas densas
 * que hoy funcionan. Exigirles 44 px aquí sería contradecir esa decisión desde un test.
 */
const PANTALLAS: { ruta: string; sesion: string; tactil: boolean }[] = [
  { ruta: '/waiter', sesion: ROLES.mesero.file, tactil: true },
  { ruta: '/waiter/ordenes', sesion: ROLES.mesero.file, tactil: true },
  { ruta: '/kitchen', sesion: ROLES.cocina.file, tactil: true },
  { ruta: '/pos', sesion: ROLES.cajero.file, tactil: true },
  { ruta: '/admin', sesion: ROLES.admin.file, tactil: false },
  { ruta: '/admin/orders', sesion: ROLES.admin.file, tactil: false },
];

for (const { ruta, sesion, tactil } of PANTALLAS) {
  test.describe(ruta, () => {
    test.use({ storageState: sesion });

    test('no se desborda a lo ancho', async ({ page }) => {
      await page.goto(ruta);
      await page.waitForLoadState('networkidle');

      const { scrollWidth, innerWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));

      // Un píxel de margen por el redondeo de los anchos fraccionarios del layout.
      expect(scrollWidth, `${ruta} desborda ${scrollWidth - innerWidth}px`).toBeLessThanOrEqual(
        innerWidth + 1,
      );
    });

    test('los controles principales se pueden tocar', async ({ page }) => {
      // Dentro del test y no en el `describe`: ahí saltaría también la prueba de desbordamiento,
      // que sí aplica a todas — un `/admin` que se salga a lo ancho en un móvil es un fallo.
      test.skip(!tactil, 'pantalla de administración: se usa con ratón, no con el dedo');

      await page.goto(ruta);
      await page.waitForLoadState('networkidle');

      // No se mide todo botón de la pantalla: los enlaces de texto y los iconos de la barra
      // superior no son objetivos táctiles primarios y exigirles 44 px reescribiría el cromo.
      // Se mide lo que un empleado pulsa para trabajar.
      const botones = page.locator('main button:visible');
      const total = await botones.count();

      for (let i = 0; i < Math.min(total, 12); i++) {
        const caja = await botones.nth(i).boundingBox();
        if (!caja) continue;
        // 36 px es el suelo duro: por debajo el dedo falla. Los 44 px del sistema de diseño son
        // el objetivo de los controles de servicio, y eso lo afirma `button.spec.tsx` sobre la
        // clase; aquí se vigila que ninguna maqueta los aplaste al reflujo del móvil.
        expect(caja.height, `botón ${i} de ${ruta} mide ${caja.height}px`).toBeGreaterThanOrEqual(
          36,
        );
      }
    });
  });
}
