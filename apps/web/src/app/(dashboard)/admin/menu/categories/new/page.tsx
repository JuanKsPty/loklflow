import { CategoryForm } from '@/components/admin/menu/category-form';
import { PageHeader } from '@/components/page-header';

export const metadata = { title: 'Nueva categoría — LoklFlow' };

export default function NewCategoryPage() {
  return (
    <div>
      <PageHeader title="Nueva categoría" description="Organiza los productos del menú." />
      <CategoryForm />
    </div>
  );
}
