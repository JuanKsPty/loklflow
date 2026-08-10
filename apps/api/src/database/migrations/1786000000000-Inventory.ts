import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Módulo de inventario: proveedores, ingredientes, recetas y movimientos de stock.
 *
 * El diseño viene de `docs/DATA_MODEL.md` §6 y se respeta tal cual, con una sola adición que
 * no estaba y que es la razón de ser de esta nota:
 *
 * **`idx_stock_movements_one_consumption_per_order_ingredient`**, un índice único parcial que
 * impide descontar dos veces el mismo ingrediente por la misma orden. El consumo se registra
 * al cerrar la cuenta, y a un cierre se puede llegar dos veces: hoy, porque dos pagos
 * concurrentes que saldan la cuenta pueden entrar los dos en `closeFromPayment`; y mañana,
 * porque la cola sin conexión de la Fase 4 reenvía operaciones por diseño. Sin el índice, el
 * segundo cierre resta el stock otra vez y el inventario deja de valer para nada.
 *
 * Es la misma lección de `idx_shifts_one_open_per_user` y de la idempotencia de las órdenes:
 * cuesta una línea ahora y una migración con limpieza de datos después.
 *
 * El índice es **parcial** a propósito: solo aplica a los movimientos de tipo `consumption`.
 * Una misma orden puede acumular ajustes o mermas sin chocar, y las entradas de mercancía no
 * llevan `order_id`.
 */
export class Inventory1786000000000 implements MigrationInterface {
  name = 'Inventory1786000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."ingredients_unit_enum" AS ENUM('kg', 'g', 'l', 'ml', 'units', 'portions')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."stock_movements_type_enum" AS ENUM('entry', 'consumption', 'waste', 'adjustment')`,
    );

    await queryRunner.query(`
      CREATE TABLE "suppliers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(150) NOT NULL,
        "contact_name" character varying(100),
        "phone" character varying(20),
        "email" character varying(255),
        "notes" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_suppliers" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "ingredients" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(150) NOT NULL,
        "unit" "public"."ingredients_unit_enum" NOT NULL,
        "current_stock" numeric(12,3) NOT NULL DEFAULT '0',
        "minimum_stock" numeric(12,3) NOT NULL DEFAULT '0',
        "cost_per_unit" numeric(10,4) NOT NULL DEFAULT '0',
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ingredients" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_ingredients_name" UNIQUE ("name")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "recipe_ingredients" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "product_id" uuid NOT NULL,
        "ingredient_id" uuid NOT NULL,
        "quantity" numeric(12,3) NOT NULL,
        CONSTRAINT "PK_recipe_ingredients" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_recipe_ingredients_quantity" CHECK ("quantity" > 0)
      )
    `);
    // Un ingrediente aparece una sola vez en la receta de un producto. Sin esto, dos filas
    // del mismo par se descuentan las dos y la receta miente sobre lo que cuesta el plato.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_recipe_ingredients_product_ingredient" ON "recipe_ingredients" ("product_id", "ingredient_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "stock_movements" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "ingredient_id" uuid NOT NULL,
        "type" "public"."stock_movements_type_enum" NOT NULL,
        "quantity" numeric(12,3) NOT NULL,
        "previous_stock" numeric(12,3) NOT NULL,
        "new_stock" numeric(12,3) NOT NULL,
        "reason" character varying(255),
        "supplier_id" uuid,
        "order_id" uuid,
        "created_by" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_stock_movements" PRIMARY KEY ("id")
      )
    `);

    // La red que impide el doble descuento. Ver la nota de arriba.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_stock_movements_one_consumption_per_order_ingredient"
      ON "stock_movements" ("order_id", "ingredient_id")
      WHERE type = 'consumption'
    `);
    // El listado del historial se filtra casi siempre por ingrediente y por fecha.
    await queryRunner.query(
      `CREATE INDEX "IDX_stock_movements_ingredient_created" ON "stock_movements" ("ingredient_id", "created_at")`,
    );

    await queryRunner.query(
      `ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "FK_recipe_ingredients_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    // RESTRICT y no CASCADE: borrar un ingrediente que está en una receta tiene que fallar
    // en voz alta, no vaciar la receta en silencio y dejar el plato costando cero.
    await queryRunner.query(
      `ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "FK_recipe_ingredients_ingredient" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_movements" ADD CONSTRAINT "FK_stock_movements_ingredient" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_movements" ADD CONSTRAINT "FK_stock_movements_supplier" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    // El movimiento es la contabilidad del stock y sobrevive a la orden que lo provocó: si
    // algún día se purga el histórico de órdenes, el inventario no puede descuadrarse.
    await queryRunner.query(
      `ALTER TABLE "stock_movements" ADD CONSTRAINT "FK_stock_movements_order" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_movements" ADD CONSTRAINT "FK_stock_movements_user" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "stock_movements" DROP CONSTRAINT "FK_stock_movements_user"`);
    await queryRunner.query(`ALTER TABLE "stock_movements" DROP CONSTRAINT "FK_stock_movements_order"`);
    await queryRunner.query(`ALTER TABLE "stock_movements" DROP CONSTRAINT "FK_stock_movements_supplier"`);
    await queryRunner.query(`ALTER TABLE "stock_movements" DROP CONSTRAINT "FK_stock_movements_ingredient"`);
    await queryRunner.query(`ALTER TABLE "recipe_ingredients" DROP CONSTRAINT "FK_recipe_ingredients_ingredient"`);
    await queryRunner.query(`ALTER TABLE "recipe_ingredients" DROP CONSTRAINT "FK_recipe_ingredients_product"`);
    await queryRunner.query(`DROP INDEX "IDX_stock_movements_ingredient_created"`);
    await queryRunner.query(`DROP INDEX "idx_stock_movements_one_consumption_per_order_ingredient"`);
    await queryRunner.query(`DROP TABLE "stock_movements"`);
    await queryRunner.query(`DROP INDEX "UQ_recipe_ingredients_product_ingredient"`);
    await queryRunner.query(`DROP TABLE "recipe_ingredients"`);
    await queryRunner.query(`DROP TABLE "ingredients"`);
    await queryRunner.query(`DROP TABLE "suppliers"`);
    await queryRunner.query(`DROP TYPE "public"."stock_movements_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."ingredients_unit_enum"`);
  }
}
