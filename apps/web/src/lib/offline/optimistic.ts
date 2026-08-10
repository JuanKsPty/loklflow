import type { Order, OrderItem, Product } from '@loklflow/types';
import { COLLECTIONS, getRow, putMany } from './cache';

/**
 * Escrituras optimistas que la superposición de la cola **no puede** reconstruir.
 *
 * `apply-pending.ts` reconstruye estados, cantidades y borrados del propio cuerpo de la
 * operación, porque son valores absolutos. Añadir un producto no: hace falta su nombre y su
 * precio, y eso solo lo sabe la pantalla que lo acaba de elegir del catálogo. Reconstruirlo
 * desde la cola significaría inventarse un precio, y un precio inventado en una comanda es
 * exactamente el tipo de error que nadie perdona.
 *
 * Así que la línea se escribe aquí, en la copia local, con los datos del catálogo que la
 * pantalla ya tiene delante. **Con el mismo id** que la cola envía al servidor: cuando la
 * operación se sincronice, la respuesta del servidor traerá esa misma línea y la sobrescribirá
 * sin duplicarla.
 */

function itemSubtotal(unitPrice: number, quantity: number): number {
  return Number((unitPrice * quantity).toFixed(2));
}

/**
 * Añade una línea a la cuenta guardada en el dispositivo.
 *
 * No toca el descuento ni la propina: la cola no difiere ninguno de los dos, así que sus
 * valores son siempre del servidor. El total que sale de aquí es orientativo mientras haya
 * pendientes; el bueno lo fija el servidor al sincronizar.
 */
export async function addItemLocally(
  orderId: string,
  itemId: string,
  product: Product,
  quantity: number,
  notes?: string,
): Promise<void> {
  const order = await getRow<Order>(COLLECTIONS.orders, orderId);
  if (!order) return;

  const item = {
    id: itemId,
    productId: product.id,
    product,
    quantity,
    unitPrice: Number(product.price),
    subtotal: itemSubtotal(Number(product.price), quantity),
    notes: notes ?? null,
    status: 'pending',
    modifiers: [],
    createdAt: new Date().toISOString(),
  } as unknown as OrderItem;

  const items = [...(order.items ?? []), item];
  const subtotal = items
    .filter((i) => i.status !== 'cancelled')
    .reduce((sum, i) => sum + Number(i.subtotal), 0);

  await putMany<Order>(COLLECTIONS.orders, [
    {
      ...order,
      items,
      subtotal: Number(subtotal.toFixed(2)),
      total: Number(
        (subtotal - Number(order.discountAmount) + Number(order.tipAmount)).toFixed(2),
      ),
    },
  ]);
}

/**
 * Guarda en el dispositivo la cuenta que se acaba de abrir sin conexión.
 *
 * `orderNumber` queda en 0 hasta que el servidor lo asigne desde su secuencia: el dispositivo
 * no puede saberlo y adivinarlo daría dos comandas con el mismo número. La interfaz enseña la
 * mesa o la etiqueta mientras tanto, que es lo que el mesero usa para reconocerla de todos
 * modos.
 */
export async function createOrderLocally(
  orderId: string,
  input: {
    tableId?: string | null;
    label?: string | null;
    notes?: string | null;
    items: { id: string; product: Product; quantity: number; notes?: string | null }[];
  },
): Promise<void> {
  const items = input.items.map(
    (line) =>
      ({
        id: line.id,
        productId: line.product.id,
        product: line.product,
        quantity: line.quantity,
        unitPrice: Number(line.product.price),
        subtotal: itemSubtotal(Number(line.product.price), line.quantity),
        notes: line.notes ?? null,
        status: 'pending',
        modifiers: [],
        createdAt: new Date().toISOString(),
      }) as unknown as OrderItem,
  );

  const subtotal = items.reduce((sum, i) => sum + Number(i.subtotal), 0);
  const now = new Date().toISOString();

  await putMany<Order>(COLLECTIONS.orders, [
    {
      id: orderId,
      orderNumber: 0,
      label: input.label ?? null,
      tableId: input.tableId ?? null,
      table: null,
      waiterId: null,
      shiftId: null,
      source: 'staff',
      status: 'pending',
      notes: input.notes ?? null,
      subtotal: Number(subtotal.toFixed(2)),
      discountAmount: 0,
      tipAmount: 0,
      total: Number(subtotal.toFixed(2)),
      mergedIntoOrderId: null,
      occurredAt: now,
      items,
      statusHistory: [],
      payments: [],
      createdAt: now,
      updatedAt: now,
    } as Order,
  ]);
}
