import { LogThrottle } from './log-throttle';

describe('LogThrottle', () => {
  it('deja pasar la primera y calla las repeticiones de la ventana', () => {
    const throttle = new LogThrottle(1000);

    expect(throttle.check('a', 0)).toEqual({ log: true, suppressed: 0 });
    expect(throttle.check('a', 100).log).toBe(false);
    expect(throttle.check('a', 900).log).toBe(false);
  });

  it('al reabrir la ventana dice cuántas se callaron', () => {
    const throttle = new LogThrottle(1000);

    throttle.check('a', 0);
    throttle.check('a', 100);
    throttle.check('a', 200);

    expect(throttle.check('a', 1500)).toEqual({ log: true, suppressed: 2 });
    // Y el contador se reinicia: la siguiente vuelta no arrastra las anteriores.
    expect(throttle.check('a', 3000)).toEqual({ log: true, suppressed: 0 });
  });

  it('cada clave lleva su propia cuenta', () => {
    const throttle = new LogThrottle(1000);

    expect(throttle.check('ip1|caducado', 0).log).toBe(true);
    expect(throttle.check('ip2|caducado', 0).log).toBe(true);
    expect(throttle.check('ip1|inválido', 0).log).toBe(true);
    expect(throttle.check('ip1|caducado', 10).log).toBe(false);
  });

  /**
   * La clave incluye el origen de la conexión, así que sin tope un cliente que rote la IP
   * convierte el mapa en una fuga de memoria que crece toda la noche.
   */
  it('no crece sin límite: desaloja lo más antiguo', () => {
    const throttle = new LogThrottle(60_000, 3);

    throttle.check('a', 0);
    throttle.check('b', 1);
    throttle.check('c', 2);
    throttle.check('d', 3); // desaloja 'a'

    // 'a' ya no está, así que vuelve a considerarse la primera vez aunque no haya pasado
    // la ventana. Es el precio del tope, y es preferible a la fuga.
    expect(throttle.check('a', 4).log).toBe(true);
    // 'd', que sí sigue dentro, se mantiene callado.
    expect(throttle.check('d', 5).log).toBe(false);
  });
});
