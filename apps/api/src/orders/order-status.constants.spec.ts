import {
  ALLOWED_TRANSITIONS,
  ORDER_STATUSES,
  type OrderStatus,
} from './order-status.constants';

const TERMINAL: OrderStatus[] = ['closed', 'cancelled'];

describe('ALLOWED_TRANSITIONS', () => {
  it('cubre todos los estados declarados', () => {
    expect(Object.keys(ALLOWED_TRANSITIONS).sort()).toEqual([...ORDER_STATUSES].sort());
  });

  it('solo apunta a estados que existen', () => {
    for (const [from, targets] of Object.entries(ALLOWED_TRANSITIONS)) {
      for (const to of targets) {
        expect(ORDER_STATUSES).toContain(to);
        expect(to).not.toBe(from); // sin auto-transiciones
      }
    }
  });

  it('deja sin salida los estados terminales', () => {
    for (const s of TERMINAL) {
      expect(ALLOWED_TRANSITIONS[s]).toEqual([]);
    }
  });

  it('permite cancelar desde cualquier estado no terminal', () => {
    for (const s of ORDER_STATUSES) {
      if (TERMINAL.includes(s)) continue;
      expect(ALLOWED_TRANSITIONS[s]).toContain('cancelled');
    }
  });

  it('recorre el camino feliz pending → preparing → ready → delivered → closed', () => {
    const happyPath: OrderStatus[] = [
      'pending',
      'preparing',
      'ready',
      'delivered',
      'closed',
    ];
    for (let i = 0; i < happyPath.length - 1; i++) {
      expect(ALLOWED_TRANSITIONS[happyPath[i]]).toContain(happyPath[i + 1]);
    }
  });

  it('no permite saltarse la cocina: pending no llega directo a ready ni a closed', () => {
    expect(ALLOWED_TRANSITIONS.pending).not.toContain('ready');
    expect(ALLOWED_TRANSITIONS.pending).not.toContain('closed');
  });

  it('no permite retroceder de estado', () => {
    const order = ORDER_STATUSES.filter((s) => !TERMINAL.includes(s));
    for (const [from, targets] of Object.entries(ALLOWED_TRANSITIONS)) {
      const fromIdx = order.indexOf(from as OrderStatus);
      if (fromIdx === -1) continue;
      for (const to of targets) {
        if (to === 'cancelled') continue;
        const toIdx = order.indexOf(to);
        if (toIdx !== -1) expect(toIdx).toBeGreaterThan(fromIdx);
      }
    }
  });

  it('hace alcanzable todo estado desde pending', () => {
    const seen = new Set<OrderStatus>(['pending']);
    const queue: OrderStatus[] = ['pending'];
    while (queue.length) {
      for (const next of ALLOWED_TRANSITIONS[queue.shift()!]) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    expect([...seen].sort()).toEqual([...ORDER_STATUSES].sort());
  });
});
