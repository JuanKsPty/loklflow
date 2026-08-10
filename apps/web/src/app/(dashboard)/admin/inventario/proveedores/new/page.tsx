import { PageHeader } from '@/components/page-header';
import { SupplierForm } from '@/components/admin/inventory/supplier-form';

export const metadata = { title: 'Nuevo proveedor — LoklFlow' };

export default function NewSupplierPage() {
  return (
    <div>
      <PageHeader title="Nuevo proveedor" description="A quién le compras los ingredientes." />
      <SupplierForm />
    </div>
  );
}
