import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * La extensión `unaccent`, que es lo que permite que buscar «cafe» encuentre «Café».
 *
 * El catálogo está escrito en español —«Café», «Panadería», «Piña colada», «Jamón»— y quien busca
 * a las once de la noche, en una tableta, de pie delante del estante, no pone los acentos. Un
 * `ILIKE '%cafe%'` no encuentra «Café»: la comparación es carácter a carácter y `e` no es `é`.
 * Sin esto, el buscador falla justo en las palabras del negocio.
 *
 * **Va en una migración y no en el arranque de la aplicación** porque crear extensiones es un
 * cambio de esquema y este repo aplica el esquema en un paso de despliegue explícito, nunca al
 * arrancar (dos instancias arrancando a la vez no deben competir por el mismo `CREATE`).
 *
 * Ojo con la trampa de desarrollo: `synchronize` construye las tablas a partir de las entidades,
 * pero **no ejecuta migraciones**. En una base de desarrollo la extensión no existirá hasta correr
 * `pnpm --filter=api migration:run`, y hasta entonces toda búsqueda revienta con
 * «function unaccent(text) does not exist». Los tests de integración no lo sufren porque
 * `test/global-setup.ts` sí corre las migraciones.
 *
 * `unaccent` viene en el paquete contrib, que la imagen oficial `postgres:16-alpine` ya trae, y
 * `CREATE EXTENSION` exige superusuario: el usuario del `docker-compose.yml` y el del CI lo son.
 * Si algún día la base gestionada no lo permitiera, el reemplazo es
 * `translate(lower(x), 'áéíóúüñ', 'aeiouun')`, que da el mismo resultado en español sin extensión.
 */
export class UnaccentExtension1786900000000 implements MigrationInterface {
  name = 'UnaccentExtension1786900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS unaccent`);
  }

  public async down(): Promise<void> {
    // No se elimina a propósito. `DROP EXTENSION` fallaría si cualquier otra cosa —una vista, un
    // índice— hubiera pasado a depender de ella, y revertir esta migración no arregla nada que
    // tenerla puesta pudiera haber roto.
  }
}
