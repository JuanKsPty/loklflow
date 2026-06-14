// Estaciones de preparación definidas localmente para mantener el backend
// autocontenido (sin importar @loklflow/types en compilación).
export const PREPARATION_STATIONS = ['kitchen', 'bar', 'immediate'] as const;
export type PreparationStation = (typeof PREPARATION_STATIONS)[number];
