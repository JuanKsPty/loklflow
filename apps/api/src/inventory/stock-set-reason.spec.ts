import { stockSetReason } from './inventory.constants';

describe('stockSetReason', () => {
  it('traduce el código a la etiqueta que se guarda en el libro mayor', () => {
    expect(stockSetReason('count')).toBe('Recuento');
    expect(stockSetReason('purchase')).toBe('Compra');
    expect(stockSetReason('waste')).toBe('Merma');
  });

  it('pega la nota del operario detrás de la etiqueta', () => {
    expect(stockSetReason('waste', 'se cayó una caja')).toBe('Merma · se cayó una caja');
  });

  it('una nota en blanco no deja el separador colgando', () => {
    expect(stockSetReason('count', '   ')).toBe('Recuento');
    expect(stockSetReason('count', '')).toBe('Recuento');
  });

  it('recorta a los 255 caracteres que caben en la columna', () => {
    // Sin esto, una nota larga sale como un error de base de datos sobre una pantalla que solo
    // dice «ahora tengo 12».
    expect(stockSetReason('count', 'x'.repeat(400))).toHaveLength(255);
  });
});
