import { LoginAttemptsService } from './login-attempts.service';

describe('bloqueo por intentos fallidos', () => {
  let clock: number;
  let service: LoginAttemptsService;

  const advance = (ms: number) => {
    clock += ms;
  };
  const fail = (times: number, key = 'mesero') => {
    let locked = false;
    for (let i = 0; i < times; i++) locked = service.registerFailure(key);
    return locked;
  };

  beforeEach(() => {
    clock = 1_000_000;
    service = new LoginAttemptsService(() => clock);
  });

  it('una clave nueva no está bloqueada', () => {
    expect(service.isLocked('mesero')).toBe(false);
  });

  it('cuatro fallos no bloquean: nadie que se equivoque nota esto', () => {
    expect(fail(4)).toBe(false);
    expect(service.isLocked('mesero')).toBe(false);
  });

  it('el quinto bloquea', () => {
    expect(fail(5)).toBe(true);
    expect(service.isLocked('mesero')).toBe(true);
  });

  it('el bloqueo caduca solo', () => {
    fail(5);

    advance(60_000 - 1);
    expect(service.isLocked('mesero')).toBe(true);

    advance(2);
    expect(service.isLocked('mesero')).toBe(false);
  });

  /**
   * Lo que convierte esto en una defensa y no en una molestia: cada tanda cuesta el doble. Contra
   * un recorrido de las 10 000 combinaciones de un PIN, el tiempo total deja de ser horas.
   */
  it('cada tanda dobla el castigo', () => {
    fail(5);
    advance(60_001);

    fail(5); // segunda tanda: dos minutos
    advance(60_001);
    expect(service.isLocked('mesero')).toBe(true);
    advance(60_001);
    expect(service.isLocked('mesero')).toBe(false);
  });

  it('el castigo tiene techo', () => {
    // Muchas tandas: sin techo, la duración se dispararía y castigaría de por vida a quien de
    // verdad se equivocó.
    for (let round = 0; round < 12; round++) {
      fail(5);
      advance(15 * 60_000 + 1);
    }

    fail(5);
    advance(15 * 60_000 + 1);
    expect(service.isLocked('mesero')).toBe(false);
  });

  it('acertar borra el historial', () => {
    fail(4);
    service.registerSuccess('mesero');

    // Quien recuerda su PIN no arrastra los fallos de ayer.
    expect(fail(4)).toBe(false);
    expect(service.isLocked('mesero')).toBe(false);
  });

  it('bloquear una clave no bloquea a otra', () => {
    fail(5, 'mesero');

    expect(service.isLocked('cajero')).toBe(false);
  });

  /**
   * La clave lleva datos que vienen de fuera, así que sin tope este mapa es un agotamiento de
   * memoria de una línea. Misma lección que `LogThrottle`.
   */
  it('el mapa tiene tope y expulsa lo más viejo', () => {
    for (let i = 0; i < 5_200; i++) {
      advance(1);
      service.registerFailure(`clave-${i}`);
    }

    expect(service.size()).toBeLessThanOrEqual(5_000);
    // Lo primero que entró es lo primero que se va.
    expect(service.isLocked('clave-0')).toBe(false);
  });
});
