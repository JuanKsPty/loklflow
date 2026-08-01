import { durationToMs } from './duration';

describe('durationToMs', () => {
  it('convierte las unidades que usa la configuración', () => {
    expect(durationToMs('30s')).toBe(30_000);
    expect(durationToMs('15m')).toBe(15 * 60_000);
    expect(durationToMs('4h')).toBe(4 * 3_600_000);
    expect(durationToMs('7d')).toBe(7 * 86_400_000);
  });

  it('tolera espacios alrededor', () => {
    expect(durationToMs(' 12h ')).toBe(12 * 3_600_000);
  });

  it('acepta varios dígitos', () => {
    expect(durationToMs('120m')).toBe(2 * 3_600_000);
  });

  it('falla en lugar de adivinar', () => {
    // Un valor que no se entienda tiene que reventar al arrancar, no producir una sesión
    // con una duración que nadie eligió.
    for (const bad of ['', '7', 'd', '7 d', '1w', '-5m', '1.5h', 'abc']) {
      expect(() => durationToMs(bad)).toThrow(/Duración inválida/);
    }
  });
});
