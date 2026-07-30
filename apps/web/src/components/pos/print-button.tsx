'use client';

import { PrinterIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Lanza el diálogo de impresión del navegador. Sin librerías. */
export function PrintButton() {
  return (
    <Button size="sm" onClick={() => window.print()}>
      <PrinterIcon />
      Imprimir
    </Button>
  );
}
