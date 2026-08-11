import { GridSkeleton, HeaderSkeleton } from '@/components/skeletons';

export default function Loading() {
  return (
    <div>
      <HeaderSkeleton />
      <GridSkeleton items={9} className="grid grid-cols-2 gap-3 sm:grid-cols-3" />
    </div>
  );
}
