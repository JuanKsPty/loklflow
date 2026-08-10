import { PageHeader } from '@/components/page-header';
import { IngredientForm } from '@/components/admin/inventory/ingredient-form';

export const metadata = { title: 'Nuevo ingrediente — LoklFlow' };

export default function NewIngredientPage() {
  return (
    <div>
      <PageHeader title="Nuevo ingrediente" description="Lo que compras y se consume al vender." />
      <IngredientForm />
    </div>
  );
}
