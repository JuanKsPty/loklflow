'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { DownloadIcon } from 'lucide-react';
import { formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { PreviewResult, PreviewRow } from '@/lib/csv/products';
import { PRODUCT_IMPORT_COLUMNS } from '@/lib/csv/products';

/** Cuántas tarjetas se pintan de una vez. El filtro que se lee de verdad es «con error». */
const POR_TANDA = 50;

const FILTROS = [
  { clave: 'todas', etiqueta: 'Todas' },
  { clave: 'create', etiqueta: 'Nuevos' },
  { clave: 'update', etiqueta: 'Se actualizan' },
  { clave: 'error', etiqueta: 'Con error' },
] as const;
type Filtro = (typeof FILTROS)[number]['clave'];

const ESTILO: Record<PreviewRow['action'], string> = {
  create: 'border-success/30 bg-success/10 text-success',
  update: 'border-info/30 bg-info/10 text-info',
  error: 'border-destructive/30 bg-destructive/10 text-destructive',
};
const ETIQUETA: Record<PreviewRow['action'], string> = {
  create: 'Nuevo',
  update: 'Actualiza',
  error: 'Error',
};

/**
 * Qué va a pasar con cada fila, **antes** de que pase.
 *
 * Tarjetas y no una tabla: ocho columnas en 390 px es desplazamiento horizontal, y en
 * desplazamiento horizontal no se compara nada. Y sin virtualización ni librería para ello: se
 * pintan cincuenta y hay un botón para ver más. El filtro que la gente abre es «con error», y ese
 * suele ser corto.
 */
export function ImportPreview({ preview }: { preview: PreviewResult }) {
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [visibles, setVisibles] = useState(POR_TANDA);

  const cuentas = useMemo(
    () => ({
      create: preview.rows.filter((r) => r.action === 'create').length,
      update: preview.rows.filter((r) => r.action === 'update').length,
      error: preview.rows.filter((r) => r.action === 'error').length,
    }),
    [preview.rows],
  );

  const filtradas = useMemo(
    () => (filtro === 'todas' ? preview.rows : preview.rows.filter((r) => r.action === filtro)),
    [preview.rows, filtro],
  );

  /**
   * Solo las filas con error, en el mismo formato, para arreglarlas en Excel y reimportar **solo
   * esas**. Compone porque la importación es idempotente por nombre.
   */
  function descargarErrores() {
    const conError = preview.rows.filter((r) => r.action === 'error');
    const cabecera = PRODUCT_IMPORT_COLUMNS.join(',');
    const cuerpo = conError.map((r) =>
      PRODUCT_IMPORT_COLUMNS.map((c) => {
        const v = r.raw[c] ?? '';
        return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
      }).join(','),
    );
    // El BOM otra vez: este archivo lo va a abrir el mismo Excel.
    const blob = new Blob(['﻿', [cabecera, ...cuerpo].join('\r\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = 'filas-con-error.csv';
      a.click();
      toast.success(`${conError.length} filas descargadas`);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        {(['create', 'update', 'error'] as const).map((k) => (
          <div key={k} className="rounded-xl border p-3 text-center">
            <p className="font-mono text-2xl font-semibold tabular-nums">{cuentas[k]}</p>
            <p className="text-xs text-muted-foreground">{ETIQUETA[k]}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTROS.map((f) => (
          <button
            key={f.clave}
            type="button"
            onClick={() => {
              setFiltro(f.clave);
              setVisibles(POR_TANDA);
            }}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors',
              filtro === f.clave
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:bg-accent',
            )}
          >
            {f.etiqueta}
          </button>
        ))}
      </div>

      {cuentas.error > 0 && (
        <Button variant="outline" size="sm" className="self-start" onClick={descargarErrores}>
          <DownloadIcon />
          {cuentas.error === 1
            ? 'Descargar la fila con error'
            : `Descargar las ${cuentas.error} filas con error`}
        </Button>
      )}

      <ul className="flex flex-col gap-2">
        {filtradas.slice(0, visibles).map((r) => (
          <li key={`${r.line}-${r.name}`} className="rounded-xl border p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="line-clamp-2 min-w-0 font-medium">{r.name || '(sin nombre)'}</p>
              <Badge variant="outline" className={ESTILO[r.action]}>
                {ETIQUETA[r.action]}
              </Badge>
            </div>

            {r.payload && (
              <p className="mt-1 font-mono text-sm tabular-nums">
                {formatPrice(r.payload.price)}
                {r.payload.categoryName ? (
                  <span className="font-sans text-muted-foreground"> · {r.payload.categoryName}</span>
                ) : null}
                {r.payload.stock !== undefined ? (
                  <span className="font-sans text-muted-foreground"> · {r.payload.stock} en stock</span>
                ) : null}
              </p>
            )}

            {r.reason && <p className="mt-1 text-sm text-destructive">{r.reason}</p>}
            {r.warnings.map((w) => (
              <p key={w} className="mt-1 text-sm text-warning">
                {w}
              </p>
            ))}

            <p className="mt-1 text-xs text-muted-foreground">
              línea {r.line}
              {/* El texto crudo de la celda, al lado de lo interpretado: es lo que permite ver que
                  «1.234» se leyó como mil doscientos treinta y cuatro antes de escribir nada. */}
              {r.raw.precio ? ` · precio en el archivo: "${r.raw.precio}"` : ''}
            </p>
          </li>
        ))}
      </ul>

      {filtradas.length > visibles && (
        <Button
          variant="outline"
          className="self-start"
          onClick={() => setVisibles((v) => v + POR_TANDA)}
        >
          Ver {Math.min(POR_TANDA, filtradas.length - visibles)} más
          <span className="text-muted-foreground">(quedan {filtradas.length - visibles})</span>
        </Button>
      )}
    </div>
  );
}
