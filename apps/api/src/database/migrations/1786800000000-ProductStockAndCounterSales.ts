import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Existencias por producto, y la venta de mostrador que las descuenta.
 *
 * El inventario de la Fase 5 modela un negocio que **transforma** insumos: descuenta harina y
 * queso al vender una pizza. Pero hay productos que *son* la unidad que se cuenta —una botella,
 * una bolsa—, y para ellos una receta de un ingrediente inventado es ceremonia pura.
 *
 * La solución es un **ingrediente espejo**: una fila de `ingredients` con `product_id`, que es ese
 * producto. Con eso el motor de stock no cambia —mismo bloqueo pesimista, mismo libro mayor
 * append-only, misma idempotencia por índice único parcial, misma alerta al cruzar el mínimo— y la
 * interfaz nunca tiene que decir la palabra «ingrediente».
 *
 * El enlace **no** vive en `recipe_ingredients` a propósito: `RecipesService.setForProduct`
 * reemplaza la receta entera, y una lista vacía es un estado válido y documentado. Guardarlo ahí
 * significaría que editar la receta de un producto borra en silencio su seguimiento de existencias,
 * y el síntoma —el stock deja de moverse— no rompe nada visible.
 *
 * Y `orders.source` gana un tercer valor, `counter`, para las ventas que el administrador registra
 * desde el panel. No es una etiqueta: es lo que impide que suenen en cocina y lo que permite
 * separarlas en un reporte. Va en esta misma migración porque desplegar media funcionalidad no
 * tiene sentido.
 */
export class ProductStockAndCounterSales1786800000000 implements MigrationInterface {
  name = 'ProductStockAndCounterSales1786800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── El ingrediente espejo ──────────────────────────────────────────────
    await queryRunner.query(`ALTER TABLE "ingredients" ADD "product_id" uuid`);

    // RESTRICT, igual que `stock_movements.ingredient_id`: borrar un producto que tiene
    // existencias tiene que fallar en voz alta, no dejar un ingrediente apuntando a nada ni
    // llevarse por delante su historial. `ProductsService.remove` lo comprueba antes para que
    // salga como un 400 explicable en vez de como un 500 de clave ajena.
    await queryRunner.query(
      `ALTER TABLE "ingredients" ADD CONSTRAINT "FK_ingredients_product" ` +
        `FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    // Un producto tiene como mucho un espejo. Índice único y no `UNIQUE` de columna: con
    // `unique: true` en la entidad, `synchronize` lo crearía con un nombre con hash y en
    // desarrollo aparecería como diferencia permanente del esquema — la misma trampa que ya
    // documenta `idx_payments_client_request_id`. En Postgres varios NULL no chocan en un índice
    // único, así que los insumos del catálogo caben todos.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_ingredients_product_id" ON "ingredients" ("product_id")`,
    );

    // ─── El nombre solo es único entre los insumos ──────────────────────────
    //
    // `products.name` **no es único**, así que dos productos pueden llamarse igual y sus dos
    // espejos también. Una unicidad global sobre `ingredients.name` haría fallar el segundo con un
    // error de base de datos en una pantalla que solo dice «ahora tengo 12».
    //
    // El bloque `DO` y no un `DROP CONSTRAINT "UQ_ingredients_name"` a secas: en una base de
    // desarrollo el esquema lo levantó `synchronize`, que nombra las restricciones de columna con
    // un hash. Un DROP por nombre fijo pasaría en producción y fallaría en la máquina de quien lo
    // escribió, que es la peor forma de que un cambio de esquema se descubra.
    await queryRunner.query(`
      DO $$
      DECLARE nombre text;
      BEGIN
        FOR nombre IN
          SELECT con.conname
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            JOIN pg_namespace ns ON ns.oid = rel.relnamespace
           WHERE ns.nspname = 'public'
             AND rel.relname = 'ingredients'
             AND con.contype = 'u'
             AND con.conkey = ARRAY[
                   (SELECT attnum FROM pg_attribute
                     WHERE attrelid = rel.oid AND attname = 'name' AND NOT attisdropped)
                 ]
        LOOP
          EXECUTE format('ALTER TABLE "ingredients" DROP CONSTRAINT %I', nombre);
        END LOOP;
      END $$;
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_ingredients_name"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_ingredients_name" ON "ingredients" ("name") WHERE "product_id" IS NULL`,
    );

    // ─── Tercer origen de orden: `counter` ──────────────────────────────────
    //
    // Baile de renombrar y no `ALTER TYPE ... ADD VALUE`. Los dos funcionan dentro de la
    // transacción en la que TypeORM corre esto (Postgres 12+ lo permite mientras el valor nuevo no
    // se use en la misma transacción, y aquí no se usa). La diferencia está en el `down`: **un enum
    // no deja quitar valores**, así que con ADD VALUE la reversión tendría que hacer este mismo
    // baile igualmente. Un `up` barato con un `down` caro.
    //
    // El coste es real: `ALTER COLUMN ... TYPE` reescribe `orders` bajo un bloqueo ACCESS
    // EXCLUSIVE. Con el histórico de un local es imperceptible; conviene aplicarlo con el local
    // cerrado igualmente.
    await queryRunner.query(
      `ALTER TYPE "public"."orders_source_enum" RENAME TO "orders_source_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."orders_source_enum" AS ENUM('staff', 'customer_qr', 'counter')`,
    );
    // El default se suelta antes: Postgres no puede castear la expresión por defecto al tipo nuevo
    // mientras la columna todavía apunta al viejo.
    await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "source" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "orders" ALTER COLUMN "source" TYPE "public"."orders_source_enum" ` +
        `USING "source"::"text"::"public"."orders_source_enum"`,
    );
    await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "source" SET DEFAULT 'staff'`);
    await queryRunner.query(`DROP TYPE "public"."orders_source_enum_old"`);
  }

  /**
   * **Este `down` destruye datos, y no hay forma honesta de que no lo haga.**
   *
   * Sin `product_id`, un ingrediente espejo no significa nada: es una fila con el nombre de un
   * producto y un stock enlazado a nada. Dejarlos sería peor que borrarlos —quedarían mezclados con
   * el catálogo de insumos, y la unicidad global del nombre que se restaura fallaría en cuanto dos
   * productos se llamaran igual—, así que se borran con su libro mayor.
   *
   * Las órdenes de mostrador, en cambio, se reetiquetan como `staff`: son ventas reales con dinero
   * cobrado detrás, y ese dinero tiene que seguir cuadrando en el arqueo.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    // El orden importa: primero lo que referencia a los espejos, luego los espejos, y solo
    // entonces se puede restaurar la unicidad del nombre.
    await queryRunner.query(`
      DELETE FROM "recipe_ingredients"
       WHERE "ingredient_id" IN (SELECT "id" FROM "ingredients" WHERE "product_id" IS NOT NULL)
    `);
    await queryRunner.query(`
      DELETE FROM "stock_movements"
       WHERE "ingredient_id" IN (SELECT "id" FROM "ingredients" WHERE "product_id" IS NOT NULL)
    `);
    await queryRunner.query(`DELETE FROM "ingredients" WHERE "product_id" IS NOT NULL`);

    await queryRunner.query(`DROP INDEX "UQ_ingredients_name"`);
    await queryRunner.query(
      `ALTER TABLE "ingredients" ADD CONSTRAINT "UQ_ingredients_name" UNIQUE ("name")`,
    );
    await queryRunner.query(`DROP INDEX "UQ_ingredients_product_id"`);
    await queryRunner.query(
      `ALTER TABLE "ingredients" DROP CONSTRAINT "FK_ingredients_product"`,
    );
    await queryRunner.query(`ALTER TABLE "ingredients" DROP COLUMN "product_id"`);

    // Sin esto el cast al tipo viejo falla con cualquier fila en `counter`, y la reversión sería
    // imposible. Perder la etiqueta es aceptable; perder la venta no.
    await queryRunner.query(`UPDATE "orders" SET "source" = 'staff' WHERE "source" = 'counter'`);
    await queryRunner.query(
      `ALTER TYPE "public"."orders_source_enum" RENAME TO "orders_source_enum_new"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."orders_source_enum" AS ENUM('staff', 'customer_qr')`,
    );
    await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "source" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "orders" ALTER COLUMN "source" TYPE "public"."orders_source_enum" ` +
        `USING "source"::"text"::"public"."orders_source_enum"`,
    );
    await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "source" SET DEFAULT 'staff'`);
    await queryRunner.query(`DROP TYPE "public"."orders_source_enum_new"`);
  }
}
