import { GridSkeleton, HeaderSkeleton } from '@/components/skeletons';

export default function Loading() {
  return (
    <div>
      <HeaderSkeleton />
      <GridSkeleton items={8} className="grid grid-cols-3 gap-3 sm:grid-cols-4" />
    </div>
  );
}
