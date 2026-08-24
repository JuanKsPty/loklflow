import { aggregateConsumptions } from './consumptions';

/**
 * La aritmética del descuento, sin base de datos.
 *
 * Lo que de verdad se protege aquí es la regla de desempate: un producto que acabara teniendo
 * espejo y receta a la vez no puede descontar por los dos caminos, porque restaría cada venta dos
 * veces en silencio y para siempre.
 */
describe('aggregateConsumptions', () => {
  const PROD = 'p-1';
  const OTRO = 'p-2';
  const ESPEJO = 'i-espejo';
  const HARINA = 'i-harina';
  const QUESO = 'i-queso';

  it('un producto con existencias propias resta una unidad por unidad vendida', () => {
    const plan = aggregateConsumptions(
      [{ productId: PROD, quantity: 3 }],
      [{ ingredientId: ESPEJO, productId: PROD }],
      [],
    );

    expect(plan.consumptions).toEqual([{ ingredientId: ESPEJO, quantity: 3 }]);
    expect(plan.conflicts).toEqual([]);
  });

  it('un producto con receta resta la cantidad de la receta por las unidades vendidas', () => {
    const plan = aggregateConsumptions(
      [{ productId: PROD, quantity: 4 }],
      [],
      [{ productId: PROD, ingredientId: HARINA, quantity: 0.25 }],
    );

    expect(plan.consumptions).toEqual([{ ingredientId: HARINA, quantity: 1 }]);
  });

  it('el mismo producto en dos líneas de la cuenta se cuenta una sola vez, sumado', () => {
    // Dos líneas del mismo plato con notas distintas es lo normal en una mesa de cuatro.
    const plan = aggregateConsumptions(
      [
        { productId: PROD, quantity: 2 },
        { productId: PROD, quantity: 3 },
      ],
      [{ ingredientId: ESPEJO, productId: PROD }],
      [],
    );

    expect(plan.consumptions).toEqual([{ ingredientId: ESPEJO, quantity: 5 }]);
  });

  it('con espejo y receta a la vez gana el espejo, y la receta se ignora', () => {
    const plan = aggregateConsumptions(
      [{ productId: PROD, quantity: 2 }],
      [{ ingredientId: ESPEJO, productId: PROD }],
      [{ productId: PROD, ingredientId: HARINA, quantity: 1 }],
    );

    // Restar de menos es recuperable con un ajuste; restar dos veces no se nota nunca.
    expect(plan.consumptions).toEqual([{ ingredientId: ESPEJO, quantity: 2 }]);
  });

  it('y devuelve el conflicto para que quien llame lo deje por escrito', () => {
    const plan = aggregateConsumptions(
      [{ productId: PROD, quantity: 1 }],
      [{ ingredientId: ESPEJO, productId: PROD }],
      [{ productId: PROD, ingredientId: HARINA, quantity: 1 }],
    );

    expect(plan.conflicts).toEqual([PROD]);
  });

  it('dos productos que comparten un insumo caen en la misma línea de consumo', () => {
    const plan = aggregateConsumptions(
      [
        { productId: PROD, quantity: 2 },
        { productId: OTRO, quantity: 1 },
      ],
      [],
      [
        { productId: PROD, ingredientId: QUESO, quantity: 0.1 },
        { productId: OTRO, ingredientId: QUESO, quantity: 0.3 },
      ],
    );

    expect(plan.consumptions).toEqual([{ ingredientId: QUESO, quantity: 0.5 }]);
  });

  it('redondea a tres decimales, los mismos que la columna', () => {
    // Sumar 0.1 tres veces en coma flotante da 0.30000000000000004, y eso acabaría en el
    // historial convirtiéndolo en ruido.
    const plan = aggregateConsumptions(
      [{ productId: PROD, quantity: 3 }],
      [],
      [{ productId: PROD, ingredientId: HARINA, quantity: 0.1 }],
    );

    expect(plan.consumptions).toEqual([{ ingredientId: HARINA, quantity: 0.3 }]);
  });

  it('un producto sin espejo ni receta no produce ningún consumo', () => {
    // Está documentado como estado válido: un negocio empieza vendiendo sin haber cargado nada.
    const plan = aggregateConsumptions([{ productId: PROD, quantity: 5 }], [], []);

    expect(plan.consumptions).toEqual([]);
    expect(plan.conflicts).toEqual([]);
  });

  it('una cuenta sin líneas no produce nada y no revienta', () => {
    expect(aggregateConsumptions([], [{ ingredientId: ESPEJO, productId: PROD }], [])).toEqual({
      consumptions: [],
      conflicts: [],
    });
  });
});
