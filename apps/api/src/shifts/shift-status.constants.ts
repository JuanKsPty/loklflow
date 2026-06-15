// Estados de turno definidos localmente (sin importar @loklflow/types en compilación).
export const SHIFT_STATUSES = ['open', 'closed'] as const;
export type ShiftStatus = (typeof SHIFT_STATUSES)[number];
