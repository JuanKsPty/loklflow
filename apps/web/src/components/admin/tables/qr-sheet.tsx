'use client';

import { QRCodeSVG } from 'qrcode.react';
import { PrinterIcon } from 'lucide-react';
import type { RestaurantTable } from '@loklflow/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel } from '@/components/ui/field';
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { QrCodeIcon } from 'lucide-react';
import { qrUrlFor, useQrBaseUrl } from './use-qr-base-url';

/**
 * La hoja de códigos QR, para imprimir y laminar.
 *
 * **El QR se genera en el navegador y no en el servidor**, y no es una preferencia: el código
 * tiene que codificar una dirección que el **teléfono del cliente** pueda abrir, y la API no
 * puede saber cuál es. Ve `localhost:3001`, o un nombre de contenedor, o lo que diga
 * `CORS_ORIGINS`. El navegador que imprime la hoja, en cambio, **ya está** en la dirección
 * correcta: un administrador abre `http://192.168.1.50:3000/admin/tables` desde la red del local,
 * y `window.location.origin` es exactamente lo que hay que imprimir.
 *
 * El caso que rompe esa lógica es el administrador trabajando en `localhost`, y por eso hay un
 * campo editable con la dirección base en vez de una variable de entorno que nadie configuraría
 * bien. Se recuerda en `localStorage` porque se imprime más de una vez.
 */
export function QrSheet({ tables }: { tables: RestaurantTable[] }) {
  const [baseUrl, updateBase] = useQrBaseUrl();

  const active = tables.filter((t) => t.isActive).sort((a, b) => a.number - b.number);

  if (active.length === 0) {
    return (
      <Empty>
        <EmptyMedia variant="icon">
          <QrCodeIcon />
        </EmptyMedia>
        <EmptyTitle>No hay mesas activas</EmptyTitle>
        <EmptyDescription>Crea mesas para poder imprimir sus códigos.</EmptyDescription>
      </Empty>
    );
  }

  return (
    <div>
      {/* Todo el cromo desaparece al imprimir: la hoja son solo las tarjetas. */}
      <div className="mb-4 flex flex-col gap-3 rounded-xl border p-4 print:hidden sm:flex-row sm:items-end">
        <Field className="flex-1">
          <FieldLabel htmlFor="qr-base">Dirección del menú</FieldLabel>
          <Input
            id="qr-base"
            value={baseUrl}
            onChange={(e) => updateBase(e.target.value)}
            placeholder="http://192.168.1.50:3000"
          />
          <p className="text-xs text-muted-foreground">
            Los teléfonos de tus clientes tienen que poder abrir esta dirección. Si aquí dice{' '}
            <code className="font-mono">localhost</code>, los códigos no funcionarán en ningún
            teléfono.
          </p>
        </Field>
        <Button onClick={() => window.print()}>
          <PrinterIcon />
          Imprimir {active.length} {active.length === 1 ? 'código' : 'códigos'}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 print:grid-cols-2 print:gap-2">
        {active.map((table) => {
          const url = qrUrlFor(baseUrl, table.qrCode);
          return (
            <div
              key={table.id}
              // `break-inside-avoid` para que una tarjeta no se corte entre dos páginas.
              className="flex break-inside-avoid flex-col items-center gap-2 rounded-xl border bg-card p-5 text-center print:border-black"
            >
              <p className="text-lg font-semibold">Mesa {table.number}</p>
              {table.sector && (
                <p className="text-xs text-muted-foreground print:text-black">
                  {table.sector.name}
                </p>
              )}
              {/* `bg-white` fijo y no un token: en modo oscuro un QR sobre fondo oscuro no lo
                  lee ningún teléfono, y la hoja impresa saldría en negativo. */}
              <div className="rounded-md bg-white p-2">
                <QRCodeSVG value={url} size={168} level="M" marginSize={0} />
              </div>
              <p className="text-xs text-muted-foreground print:text-black">
                Escanea para ver el menú y pedir
              </p>
              <p className="max-w-full truncate font-mono text-[10px] text-muted-foreground print:text-black">
                {url}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
