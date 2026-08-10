'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { DownloadIcon, RefreshCwIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { RestaurantTable } from '@loklflow/types';
import { tablesApi } from '@/lib/api/tables.api';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { qrUrlFor, useQrBaseUrl } from './use-qr-base-url';

/**
 * El QR de una mesa: verlo, descargarlo y rotarlo.
 *
 * La rotación va detrás de una confirmación destructiva porque **invalida material físico**: las
 * hojas que estén puestas en las mesas dejan de servir en el instante en que se pulsa, y no hay
 * forma de deshacerlo. Es el tipo de acción cuyo coste no está en la base de datos.
 */
export function QrDialog({
  table,
  open,
  onOpenChange,
}: {
  table: RestaurantTable | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const svgRef = useRef<HTMLDivElement>(null);
  const [baseUrl] = useQrBaseUrl();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!table) return null;
  // Alias no nulo: TypeScript no propaga el estrechamiento de `table` dentro de los closures de
  // `downloadSvg` y `rotate`, y comprobarlo otra vez dentro de cada uno sería ruido.
  const mesa = table;

  const url = qrUrlFor(baseUrl, mesa.qrCode);

  /**
   * Descarga el SVG serializando el nodo que ya está en el DOM.
   *
   * Mismo patrón que `downloadFile` en `client.ts`, incluido el `revokeObjectURL`: sin él el blob
   * se queda en memoria mientras viva la pestaña. Se elige SVG y no PNG porque una imprenta puede
   * escalarlo a cualquier tamaño sin que el código pierda definición.
   */
  function downloadSvg() {
    const svg = svgRef.current?.querySelector('svg');
    if (!svg) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], {
      type: 'image/svg+xml;charset=utf-8',
    });
    const href = URL.createObjectURL(blob);
    try {
      const a = document.createElement('a');
      a.href = href;
      a.download = `mesa-${mesa.number}-qr.svg`;
      a.click();
    } finally {
      URL.revokeObjectURL(href);
    }
  }

  async function rotate() {
    setBusy(true);
    try {
      await tablesApi.rotateQr(mesa.id);
      toast.success(`QR de la mesa ${mesa.number} regenerado`);
      setAsking(false);
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo regenerar el QR');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>QR de la mesa {mesa.number}</DialogTitle>
            <DialogDescription>
              El cliente lo escanea para ver el menú y pedir desde su teléfono.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-3">
            {/* Fondo blanco fijo: en modo oscuro un QR sobre fondo oscuro no lo lee ningún
                teléfono. */}
            <div ref={svgRef} className="rounded-md bg-white p-3">
              <QRCodeSVG value={url} size={200} level="M" marginSize={0} />
            </div>
            <p className="max-w-full truncate font-mono text-xs text-muted-foreground">{url}</p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="flex-1" onClick={downloadSvg}>
              <DownloadIcon />
              Descargar SVG
            </Button>
            <Button
              variant="outline"
              className="flex-1 text-destructive"
              onClick={() => setAsking(true)}
            >
              <RefreshCwIcon />
              Regenerar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={asking} onOpenChange={setAsking}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Regenerar el QR de la mesa {mesa.number}?</AlertDialogTitle>
            <AlertDialogDescription>
              El código actual deja de funcionar <strong>inmediatamente</strong>. Cualquier hoja
              impresa que esté en esa mesa habrá que sustituirla, y un cliente que la escanee verá
              que no existe. Hazlo si el código se filtró o si la hoja se cambió de mesa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={rotate} disabled={busy}>
              {busy && <Spinner />}
              Regenerar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
