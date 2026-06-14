export type PreparationStation = 'kitchen' | 'bar' | 'immediate';

export const PREPARATION_STATIONS: PreparationStation[] = ['kitchen', 'bar', 'immediate'];

export const PREPARATION_STATION_LABELS: Record<PreparationStation, string> = {
  kitchen: 'Cocina',
  bar: 'Barra',
  immediate: 'Inmediato',
};
