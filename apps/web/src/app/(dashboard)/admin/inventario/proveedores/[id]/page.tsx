import { notFound } from 'next/navigation';
import { isNotFound, serverFetch } from '@/lib/api/server-client';
import { reportApiFailure } from '@/lib/observability/api-failure';
import { PageHeader } from '@/components/page-header';
import { ApiDownNotice } from '@/components/offline/api-down-notice';
import { SupplierForm } from '@/components/admin/inventory/supplier-form';
import { ActiveControl } from '@/components/admin/inventory/active-control';
import type { Supplier } from '@loklflow/types';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditSupplierPage({ params }: Props) {
  const { id } = await params;

  let supplier: Supplier | null = null;
  let failure: 'offline' | 'error' | null = null;
  try {
    supplier = await serverFetch<Supplier>(`/inventory/suppliers/${id}`);
  } catch (err) {
    if (isNotFound(err)) notFound();
    failure = reportApiFailure('admin/inventario/proveedor', err);
  }

  if (!supplier) {
    return (
      <div>
        <PageHeader title="Proveedor" />
        <ApiDownNotice what="el proveedor" reason={failure ?? 'error'} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Editar proveedor" description={supplier.name} />
      <SupplierForm supplier={supplier} />
      <div className="mt-6">
        <ActiveControl
          kind="supplier"
          id={supplier.id}
          isActive={supplier.isActive}
          name={supplier.name}
        />
      </div>
    </div>
  );
}
