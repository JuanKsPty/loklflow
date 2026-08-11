import { checkPin, isAcceptablePin } from './pin-policy';

const reject = (pin: string) => expect(checkPin(pin).ok).toBe(false);
const accept = (pin: string) => expect(checkPin(pin)).toEqual({ ok: true });

describe('política de PIN', () => {
  describe('formato', () => {
    it.each(['123', '1234567', '', 'abcd', '12a4', '12 34'])('rechaza «%s»', reject);

    it('acepta cuatro, cinco y seis dígitos', () => {
      accept('2846');
      accept('28461');
      accept('284619');
    });
  });

  describe('lo que la gente elige de verdad', () => {
    it.each(['0000', '1111', '9999', '111111'])('rechaza el repetido «%s»', reject);

    it.each(['1234', '4321', '0123', '9876', '123456', '654321'])(
      'rechaza la secuencia «%s»',
      reject,
    );

    /**
     * Los PINs «aleatorios» que la gente teclea mirando el teclado: líneas rectas de arriba abajo.
     * No los atrapa ninguna regla de repetición ni de secuencia numérica.
     */
    it.each(['2580', '1470', '3690'])('rechaza la línea del teclado «%s»', reject);

    it.each(['1212', '7777', '2001', '6969'])('rechaza el común «%s»', reject);
  });

  describe('lo que sí vale', () => {
    it.each(['2846', '9173', '5029', '7391', '4802'])('acepta «%s»', accept);

    it('un PIN con dígitos repetidos, pero no todos, vale', () => {
      accept('2282');
    });

    it('una secuencia de dos en dos no es secuencia', () => {
      // La regla es «de uno en uno»: pasarse de lista aquí rechazaría PINs perfectamente buenos.
      accept('2468');
    });
  });

  it('el motivo se le puede enseñar a una persona', () => {
    const verdict = checkPin('1234');

    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.reason).toMatch(/secuencia/i);
      // Nada de jerga: lo lee un mesero, no un programador.
      expect(verdict.reason).not.toMatch(/regex|policy|invalid/i);
    }
  });

  it('el atajo booleano coincide con el veredicto', () => {
    expect(isAcceptablePin('2846')).toBe(true);
    expect(isAcceptablePin('1234')).toBe(false);
  });
});
