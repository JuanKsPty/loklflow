import { config as loadEnv } from 'dotenv';
import path from 'node:path';

/**
 * Carga el `.env` de la raíz del monorepo, que la API comparte con el frontend.
 *
 * Existe como función única porque la ruta relativa se contaba a mano en cada sitio que la
 * necesitaba, y basta equivocarse en un nivel para que dotenv no encuentre nada y no avise:
 * la conexión se cae silenciosamente a los valores por defecto. Aquí el `__dirname` es
 * siempre `src/config` o `dist/config`, que están a la misma profundidad, así que la cuenta
 * es una sola y no depende de quién llame.
 *
 * No hace falta en el arranque normal de la API: para eso está el `envFilePath` de
 * `ConfigModule`. Es para lo que corre fuera de Nest — la CLI de TypeORM, el seed y el
 * arranque de los tests de integración.
 */
export function loadRootEnv(): void {
  loadEnv({ path: path.resolve(__dirname, '../../../../.env') });
}
