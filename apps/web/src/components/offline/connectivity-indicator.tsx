'use client';

import { useState } from 'react';
import { AlertTriangleIcon, CheckIcon, CloudOffIcon, RefreshCwIcon } from 'lucide-react';
import { useFailedOperations, usePendingOperations } from '@/lib/offline/use-outbox';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useConnectivity } from './offline-provider';
import { SyncTray } from './sync-tray';

/**
 * El estado de la sincronización, siempre a la vista.
 *
 * Va en las tres cabeceras operativas, y está **siempre**, también cuando todo va bien. Un
 * indicador que solo aparece cuando hay problemas enseña a no mirar ese rincón, y el día que
 * aparece nadie lo ve. En verde ocupa un punto; es barato.
 *
 * Cuatro estados, en orden de urgencia: algo sin enviar (rojo, alguien tiene que decidir),
 * sincronizando, sin conexión con N esperando, y al día. Pulsarlo abre siempre la bandeja,
 * incluso en verde: es el sitio donde comprobar que de verdad no queda nada, que es la
 * pregunta que se hace un cajero antes de cerrar el turno.
 */
export function ConnectivityIndicator() {
  const { online, syncing, needsAuth } = useConnectivity();
  const pending = usePendingOperations();
  const stuck = useFailedOperations();
  const [open, setOpen] = useState(false);

  const state = stuck.length > 0 || needsAuth
    ? 'stuck'
    : syncing
      ? 'syncing'
      : !online
        ? 'offline'
        : pending.length > 0
          ? 'waiting'
          : 'clean';

  const label =
    state === 'stuck'
      ? needsAuth
        ? 'Sesión caducada'
        : `${stuck.length} sin enviar`
      : state === 'syncing'
        ? 'Sincronizando…'
        : state === 'offline'
          ? pending.length > 0
            ? `Sin conexión · ${pending.length}`
            : 'Sin conexión'
          : state === 'waiting'
            ? `${pending.length} en cola`
            : 'Al día';

  const tone =
    state === 'stuck'
      ? 'text-destructive'
      : state === 'offline'
        ? 'text-warning'
        : 'text-muted-foreground';

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className={`gap-1.5 ${tone}`}
              onClick={() => setOpen(true)}
              // El texto va también en el nombre accesible: en la versión estrecha solo se ve
              // el icono, y un icono a secas no dice nada a un lector de pantalla.
              aria-label={`Sincronización: ${label}`}
            >
              {state === 'stuck' && <AlertTriangleIcon />}
              {state === 'syncing' && <RefreshCwIcon className="animate-spin" />}
              {state === 'offline' && <CloudOffIcon />}
              {state === 'waiting' && <RefreshCwIcon />}
              {state === 'clean' && <CheckIcon />}
              <span className="hidden text-xs sm:inline">{label}</span>
            </Button>
          }
        />
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <SyncTray open={open} onOpenChange={setOpen} />
    </>
  );
}
