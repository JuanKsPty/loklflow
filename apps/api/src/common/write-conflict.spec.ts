import { QueryFailedError } from 'typeorm';
import { isConcurrentWriteConflict } from './write-conflict';

/** Un error del driver con el código que devolvería Postgres. */
function pgError(code: string, message = 'algo falló'): QueryFailedError {
  const err = new QueryFailedError('SELECT 1', [], new Error(message));
  (err as QueryFailedError & { code?: string }).code = code;
  return err;
}

describe('isConcurrentWriteConflict', () => {
  it('reconoce la violación de unicidad', () => {
    expect(isConcurrentWriteConflict(pgError('23505'))).toBe(true);
  });

  /**
   * **El caso que se escapaba.** Cuando dos peticiones insertan la misma orden a la vez, la
   * inserción arrastra en cascada los ítems y el historial; las dos transacciones toman los
   * cerrojos en distinto orden y Postgres mata a una con `40P01`. Como el código solo miraba la
   * unicidad, salía como 500 — y para la cola sin conexión un 500 es definitivo, así que la
   * comanda acababa en la bandeja de fallos habiendo sido creada.
   */
  it('reconoce el interbloqueo', () => {
    expect(isConcurrentWriteConflict(pgError('40P01', 'deadlock detected'))).toBe(true);
  });

  it('reconoce el fallo de serialización', () => {
    expect(isConcurrentWriteConflict(pgError('40001'))).toBe(true);
  });

  describe('lo que no es un conflicto', () => {
    it('una clave ajena que no existe', () => {
      // 23503 es de la misma familia que la unicidad y significa lo contrario: el dato está mal,
      // no hay nadie con quien competir. Tragárselo devolvería un 200 sobre una fila inexistente.
      expect(isConcurrentWriteConflict(pgError('23503'))).toBe(false);
    });

    it('una columna nula obligatoria', () => {
      expect(isConcurrentWriteConflict(pgError('23502'))).toBe(false);
    });

    it('un error que no viene del driver', () => {
      expect(isConcurrentWriteConflict(new Error('duplicate key'))).toBe(false);
    });

    it('un error de consulta sin código', () => {
      expect(isConcurrentWriteConflict(new QueryFailedError('SELECT 1', [], new Error('x')))).toBe(
        false,
      );
    });

    it.each([null, undefined, 'texto', 42])('«%s» no lo es', (value) => {
      expect(isConcurrentWriteConflict(value)).toBe(false);
    });
  });

  /**
   * Se mira el **código**, no el mensaje. Los textos de Postgres se traducen según el
   * `lc_messages` del servidor, así que un `/duplicate/i` deja de coincidir el día que la base
   * habla otro idioma — y el síntoma sería un 500 esporádico en la ruta más caliente.
   */
  it('no depende del idioma del servidor', () => {
    expect(isConcurrentWriteConflict(pgError('23505', 'llave duplicada viola restricción'))).toBe(
      true,
    );
  });
});
