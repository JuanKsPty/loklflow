import { REDACTED, redact, redactPick } from './audit-redact';

describe('redact', () => {
  it('sustituye las claves sensibles y deja el resto intacto', () => {
    expect(redact({ name: 'Ana', password: 'secreta123', email: 'a@b.c' })).toEqual({
      name: 'Ana',
      password: REDACTED,
      email: 'a@b.c',
    });
  });

  it('cubre todas las variantes de nombre de credencial', () => {
    const result = redact({
      password: 'x',
      passwordHash: 'x',
      password_hash: 'x',
      pin: '1234',
      token: 'x',
      refreshToken: 'x',
      access_token: 'x',
      secret: 'x',
      apiKey: 'x',
    })!;
    for (const value of Object.values(result)) {
      expect(value).toBe(REDACTED);
    }
  });

  it('no distingue mayúsculas en el nombre de la clave', () => {
    expect(redact({ PassWord: 'x', PIN: 'y' })).toEqual({
      PassWord: REDACTED,
      PIN: REDACTED,
    });
  });

  it('redacta en objetos anidados', () => {
    expect(redact({ user: { name: 'Ana', pin: '0000' } })).toEqual({
      user: { name: 'Ana', pin: REDACTED },
    });
  });

  it('redacta dentro de arrays', () => {
    expect(redact({ users: [{ password: 'a' }, { password: 'b' }] })).toEqual({
      users: [{ password: REDACTED }, { password: REDACTED }],
    });
  });

  it('no muta el objeto original', () => {
    const input = { password: 'secreta' };
    redact(input);
    expect(input.password).toBe('secreta');
  });

  it('devuelve undefined para null y undefined, para dejar la columna en NULL', () => {
    expect(redact(null)).toBeUndefined();
    expect(redact(undefined)).toBeUndefined();
  });

  it('sobrevive a las referencias circulares', () => {
    const a: Record<string, unknown> = { name: 'Ana' };
    a.self = a;
    expect(() => redact(a)).not.toThrow();
  });

  it('conserva los valores no string tal cual', () => {
    expect(redact({ amount: 12.5, active: true, missing: null })).toEqual({
      amount: 12.5,
      active: true,
      missing: null,
    });
  });

  it('aplana instancias de clase, como las entidades de TypeORM', () => {
    class FakeUser {
      name = 'Ana';
      password = 'hash';
    }
    expect(redact(new FakeUser())).toEqual({ name: 'Ana', password: REDACTED });
  });
});

describe('redactPick', () => {
  const role = {
    id: 'r1',
    name: 'Gerente',
    maxDiscountPercentage: 50,
    isActive: true,
    secret: 'no-debe-salir',
  };

  it('solo devuelve las claves pedidas', () => {
    expect(redactPick(role, ['name', 'maxDiscountPercentage'])).toEqual({
      name: 'Gerente',
      maxDiscountPercentage: 50,
    });
  });

  it('redacta también entre las claves pedidas', () => {
    expect(redactPick(role, ['name', 'secret'])).toEqual({
      name: 'Gerente',
      secret: REDACTED,
    });
  });

  it('incluye como undefined las claves ausentes, para que el diff sea comparable', () => {
    const result = redactPick(role, ['name', 'description' as keyof typeof role]);
    expect(Object.keys(result)).toContain('description');
  });
});
