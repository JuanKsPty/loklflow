import { GridSkeleton, HeaderSkeleton } from '@/components/skeletons';

export default function Loading() {
  return (
    <div>
      <HeaderSkeleton />
      <GridSkeleton items={8} />
    </div>
  );
}
