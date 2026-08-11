import { GridSkeleton } from '@/components/skeletons';

export default function Loading() {
  // Tres columnas, como el KDS: pendientes, en preparación y listas.
  return <GridSkeleton items={6} className="grid grid-cols-1 gap-4 md:grid-cols-3" />;
}
