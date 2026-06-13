import { SectorForm } from '@/components/admin/tables/sector-form';
import { PageHeader } from '@/components/page-header';

export const metadata = { title: 'Nuevo sector — LoklFlow' };

export default function NewSectorPage() {
  return (
    <div>
      <PageHeader title="Nuevo sector" description="Agrupa mesas por zona del salón." />
      <SectorForm />
    </div>
  );
}
