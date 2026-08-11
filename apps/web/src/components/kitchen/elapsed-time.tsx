'use client';

import { useEffect, useState } from 'react';
import { ClockIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

function minutesSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

/** Minutos desde createdAt; tickea cada 30 s y colorea según antigüedad. */
export function ElapsedTime({ since }: { since: string }) {
  const [mins, setMins] = useState(() => minutesSince(since));

  useEffect(() => {
    // Sin `setMins` inicial: el valor ya sale del inicializador perezoso del `useState`, y
    // repetirlo aquí era una escritura de estado dentro del efecto de montaje —un render en
    // cascada por cada tarjeta del KDS, que son todas las comandas abiertas del local—.
    const id = setInterval(() => setMins(minutesSince(since)), 30000);
    return () => clearInterval(id);
  }, [since]);

  // `since` cambia de identidad al recargarse la comanda; recalcular en el render es correcto y
  // no necesita efecto, porque `minutesSince` es una función pura del reloj.

  const tone =
    mins >= 20 ? 'text-destructive' : mins >= 10 ? 'text-warning' : 'text-muted-foreground';

  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium tabular-nums', tone)}>
      <ClockIcon className="size-3.5" />
      {mins} min
    </span>
  );
}
