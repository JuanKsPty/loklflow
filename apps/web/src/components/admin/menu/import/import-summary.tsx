'use client';

import Link from 'next/link';
import { CheckCircle2Icon } from 'lucide-react';
import type { ImportProductsResult } from '@loklflow/types';
import { Button } from '@/components/ui/button';

/** Los números del **servidor**, que son los verdaderos: la previsualización pudo quedar vieja. */
export function ImportSummary({
  resultado,
  onOtra,
}: {
  resultado: ImportProductsResult;
  onOtra: () => void;
}) {
  const fallidas = resultado.rows.filter((r) => r.status === 'failed');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2 rounded-xl border border-success/30 bg-success/10 p-4 text-success">
        <CheckCircle2Icon className="mt-0.5 size-5 shrink-0" />
        <div>
          <p className="font-medium">Importación terminada</p>
          <p className="text-sm">
            {resultado.created} creados, {resultado.updated} actualizados
            {resultado.failed > 0 ? `, ${resultado.failed} con error` : ''}.
          </p>
        </div>
      </div>

      {resultado.categoriesCreated.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Categorías creadas: {resultado.categoriesCreated.join(', ')}.
        </p>
      )}

      {fallidas.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Lo que no entró</p>
          <ul className="flex flex-col gap-2">
            {fallidas.map((r) => (
              <li key={`${r.line}-${r.name}`} className="rounded-xl border p-3">
                <p className="font-medium">{r.name}</p>
                <p className="text-sm text-destructive">{r.reason}</p>
                <p className="text-xs text-muted-foreground">línea {r.line}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          nativeButton={false}
          className="w-full sm:w-auto"
          render={<Link href="/admin/menu?tab=products" />}
        >
          Ver el menú
        </Button>
        <Button variant="outline" className="w-full sm:w-auto" onClick={onOtra}>
          Importar otro archivo
        </Button>
      </div>
    </div>
  );
}
