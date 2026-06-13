import { ModifierForm } from '@/components/admin/menu/modifier-form';
import { PageHeader } from '@/components/page-header';

export const metadata = { title: 'Nuevo modificador — LoklFlow' };

export default function NewModifierPage() {
  return (
    <div>
      <PageHeader title="Nuevo modificador" description="Define un grupo de opciones para tus productos." />
      <ModifierForm />
    </div>
  );
}
