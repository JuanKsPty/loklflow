import { DashboardSkeleton, HeaderSkeleton } from '@/components/skeletons';

export default function Loading() {
  return (
    <div>
      <HeaderSkeleton />
      <DashboardSkeleton />
    </div>
  );
}
