/**
 * Las formas que viajan por la puerta pública, la que alcanza un cliente sin sesión.
 *
 * Son **más estrechas** que las del personal a propósito, y la diferencia es el punto: `Product`
 * lleva `station` y `isActive`, `RestaurantTable` lleva su propio `qrCode`, `Order` lleva
 * `waiterId`, `shiftId` y los pagos. Nada de eso le importa a un cliente y todo dice algo sobre
 * cómo funciona el negocio por dentro.
 *
 * Compartirlas en el paquete de tipos hace que el servidor y el teléfono no puedan discrepar sobre
 * qué se publica: si alguien añade un campo a la respuesta y no aquí, tsc lo dice.
 */

export interface PublicBusiness {
  name: string;
  logoUrl: string | null;
  currency: string;
  taxRate: number;
}

export interface PublicTable {
  id: string;
  number: number;
  sectorName: string | null;
  /**
   * Si la mesa está recibiendo pedidos ahora mismo.
   *
   * Lo calcula el servidor para que la pantalla pueda ponerse en modo lectura **antes** de que
   * alguien llene un carrito. Sin esto, la única forma de enterarse sería el 409 al enviar, con el
   * pedido ya hecho.
   */
  acceptsOrders: boolean;
}

export interface PublicModifierOption {
  id: string;
  name: string;
  priceAdjustment: number;
  isDefault: boolean;
}

export interface PublicModifier {
  id: string;
  name: string;
  isRequired: boolean;
  allowMultiple: boolean;
  minSelections: number;
  maxSelections: number | null;
  options: PublicModifierOption[];
}

export interface PublicProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  categoryId: string | null;
  modifiers: PublicModifier[];
}

export interface PublicCategory {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
}

export interface PublicMenu {
  business: PublicBusiness;
  table: PublicTable;
  categories: PublicCategory[];
  products: PublicProduct[];
  /** Hora del servidor. El menú está filtrado por horario contra esta, no contra el reloj del teléfono. */
  serverTime: string;
}

export interface PublicOrderItemStatus {
  name: string;
  quantity: number;
  status: string;
  notes: string | null;
  modifiers: string[];
}

export interface PublicOrderStatus {
  orderNumber: number;
  status: string;
  createdAt: string;
  tableNumber: number | null;
  items: PublicOrderItemStatus[];
  subtotal: number;
  total: number;
}

export interface PublicOrderCreated {
  order: PublicOrderStatus;
  /** El pase con el que seguir el pedido. Va en la cabecera `x-guest-token`. */
  trackingToken: string;
}

export interface PublicCreateOrderItemPayload {
  productId: string;
  quantity: number;
  notes?: string;
  modifierOptionIds?: string[];
}

export interface PublicCreateOrderPayload {
  customerName?: string;
  notes?: string;
  items: PublicCreateOrderItemPayload[];
}
