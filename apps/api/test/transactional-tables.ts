/**
 * Tablas que guardan la operación del día.
 *
 * Vive **sola y sin importaciones** para que la pueda leer también el arnés e2e de `apps/web`,
 * que llega por un `pg` pelado y no puede arrastrar TypeORM ni la configuración de Nest. Es un
 * monorepo: duplicar esta lista significaría que un día se truncan nueve tablas en un sitio y
 * diez en el otro, y el test que falle será el que no tocó nada.
 */
export const TRANSACTIONAL_TABLES = [
  'order_item_modifiers',
  'order_items',
  'order_status_history',
  'payments',
  'discounts',
  'orders',
  'shifts',
  'notifications',
  'audit_logs',
  'reservations',
  // Inventario. El seed no lo siembra, así que vaciarlo no destruye catálogo. Van explícitas
  // aunque `TRUNCATE ... CASCADE` sobre `orders` ya arrastraría `stock_movements` —CASCADE
  // alcanza a cualquier tabla que referencie, al margen del `ON DELETE` declarado—: depender
  // de ese efecto lateral dejaría el stock de los ingredientes intacto y las suites se
  // contaminarían entre sí.
  'stock_movements',
  'recipe_ingredients',
  'ingredients',
  'suppliers',
] as const;
