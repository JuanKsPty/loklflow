'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { DownloadIcon } from 'lucide-react';
import { downloadFile } from '@/lib/api/client';
import { reportsApi } from '@/lib/api/reports.api';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

interface Props {
  from?: string;
  to?: string;
  /** Sufijo del nombre del archivo, por ejemplo el rango elegido. */
  label: string;
}

export function ExportButton({ from, to, label }: Props) {
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      await downloadFile(
        reportsApi.salesCsvPath({ from, to }),
        `ventas-${label}.csv`,
      );
      toast.success('CSV descargado');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al exportar');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={download} disabled={busy}>
      {busy ? <Spinner /> : <DownloadIcon />}
      Exportar CSV
    </Button>
  );
}
