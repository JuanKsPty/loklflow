import { FUTURE_TOLERANCE_MS, MAX_AGE_MS, saneOccurredAt } from './occurred-at';

const NOW = new Date('2026-08-10T21:00:00.000Z');
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const ahead = (ms: number) => new Date(NOW.getTime() + ms).toISOString();

describe('saneOccurredAt', () => {
  it('descarta lo que no viene', () => {
    expect(saneOccurredAt(undefined, NOW)).toBeNull();
    expect(saneOccurredAt(null, NOW)).toBeNull();
    expect(saneOccurredAt('', NOW)).toBeNull();
  });

  it('descarta lo que no parsea', () => {
    expect(saneOccurredAt('ayer por la tarde', NOW)).toBeNull();
    expect(saneOccurredAt('2026-13-45T99:99:99Z', NOW)).toBeNull();
  });

  it('acepta una hora reciente y la devuelve tal cual', () => {
    const at = saneOccurredAt(ago(25 * 60 * 1000), NOW);
    expect(at).toEqual(new Date(NOW.getTime() - 25 * 60 * 1000));
  });

  it('acepta el instante exacto de ahora', () => {
    expect(saneOccurredAt(NOW.toISOString(), NOW)).toEqual(NOW);
  });

  // Un desfase de segundos entre el reloj de la tablet y el del servidor es normal, y
  // convertirlo en «hora inválida» haría que las operaciones en línea también perdieran el
  // sello por un motivo que no le importa a nadie.
  it('tolera un futuro pequeño, dentro del margen de reloj', () => {
    const at = saneOccurredAt(ahead(FUTURE_TOLERANCE_MS - 1000), NOW);
    expect(at).not.toBeNull();
  });

  it('descarta un futuro mayor que el margen', () => {
    expect(saneOccurredAt(ahead(FUTURE_TOLERANCE_MS + 1000), NOW)).toBeNull();
  });

  // El caso real: una tablet con la fecha de fábrica manda 2016, o alguien resucita una cola
  // de la semana pasada. Fecharlo así ensuciaría reportes de días ya cerrados.
  it('descarta lo demasiado viejo', () => {
    expect(saneOccurredAt(ago(MAX_AGE_MS + 60_000), NOW)).toBeNull();
    expect(saneOccurredAt('2016-01-01T00:00:00.000Z', NOW)).toBeNull();
  });

  it('acepta justo dentro de la ventana de 48 h', () => {
    expect(saneOccurredAt(ago(MAX_AGE_MS - 60_000), NOW)).not.toBeNull();
  });

  // El arnés fuerza TZ=America/Mexico_City y CI corre en UTC: comparar instantes, nunca
  // cadenas formateadas, o esto pasa en un sitio y falla en el otro.
  it('conserva el instante aunque venga con otro desplazamiento horario', () => {
    const utc = saneOccurredAt('2026-08-10T20:30:00.000Z', NOW);
    const offset = saneOccurredAt('2026-08-10T14:30:00.000-06:00', NOW);
    expect(offset?.getTime()).toBe(utc?.getTime());
  });
});
