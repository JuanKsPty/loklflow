import { toUtcTimestamp } from './utc-timestamp';

describe('toUtcTimestamp', () => {
  it('produce el formato que espera un timestamp sin zona', () => {
    expect(toUtcTimestamp(new Date('2026-07-29T01:21:09.745Z'))).toBe(
      '2026-07-29 01:21:09',
    );
  });

  it('no lleva ni la T ni el indicador de zona', () => {
    const s = toUtcTimestamp(new Date('2026-01-02T03:04:05.000Z'));
    expect(s).not.toContain('T');
    expect(s).not.toContain('Z');
    expect(s).not.toMatch(/[+-]\d{2}:\d{2}$/);
  });

  it('descarta los milisegundos', () => {
    expect(toUtcTimestamp(new Date('2026-07-29T01:21:09.999Z'))).toBe(
      '2026-07-29 01:21:09',
    );
  });

  it('mantiene el instante en UTC, no en la zona local del proceso', () => {
    // Este es el bug que arregla: un Date construido con componentes locales debe
    // serializarse en UTC, o el rango del reporte queda desplazado por el offset.
    const local = new Date(2026, 6, 29, 0, 0, 0, 0); // medianoche local
    const expected = local.toISOString().slice(0, 19).replace('T', ' ');
    expect(toUtcTimestamp(local)).toBe(expected);
    // Y el resultado coincide con las partes UTC, no con las locales.
    expect(toUtcTimestamp(local).slice(11, 13)).toBe(
      String(local.getUTCHours()).padStart(2, '0'),
    );
  });

  it('respeta el cambio de día que provoca el offset', () => {
    // 20:00 en GMT-5 es 01:00 del día siguiente en UTC.
    expect(toUtcTimestamp(new Date('2026-07-29T01:00:00.000Z'))).toBe(
      '2026-07-29 01:00:00',
    );
  });
});
