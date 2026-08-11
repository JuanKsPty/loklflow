import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { ROLES } from './support/roles';

/**
 * Accesibilidad automatizada: cero violaciones `serious` o `critical`.
 *
 * Es la mitad determinista de la Fase 6 —la que sí se puede poner en CI—, frente a Lighthouse,
 * que en un runner compartido tiene una varianza de ±10 puntos y crea un gate intermitente que la
 * gente aprende a relanzar.
 *
 * Se filtra por severidad a propósito. Las de nivel `minor` y `moderate` de axe incluyen cosas
 * como el contraste de un texto deshabilitado, y ponerlas en el mismo saco que un botón sin
 * nombre accesible convierte la lista en ruido que nadie lee. `jsx-a11y` en el lint cubre lo
 * estático; esto cubre lo que solo existe una vez renderizado.
 */

const PANTALLAS: { ruta: string; sesion: string }[] = [
  { ruta: '/login', sesion: '' },
  { ruta: '/waiter', sesion: ROLES.mesero.file },
  { ruta: '/kitchen', sesion: ROLES.cocina.file },
  { ruta: '/pos', sesion: ROLES.cajero.file },
  { ruta: '/admin', sesion: ROLES.admin.file },
];

for (const { ruta, sesion } of PANTALLAS) {
  test.describe(ruta, () => {
    test.use(sesion ? { storageState: sesion } : { storageState: { cookies: [], origins: [] } });

    test('sin violaciones graves de accesibilidad', async ({ page }) => {
      await page.goto(ruta);
      await page.waitForLoadState('networkidle');

      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      const graves = violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical',
      );

      // El mensaje lleva la regla y el selector: un fallo tiene que decir qué arreglar, no
      // solamente que algo está mal.
      const detalle = graves
        .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
        .join('\n');
      expect(graves, `${ruta}\n${detalle}`).toHaveLength(0);
    });
  });
}
