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
    setMins(minutesSince(since));
    const id = setInterval(() => setMins(minutesSince(since)), 30000);
    return () => clearInterval(id);
  }, [since]);

  const tone =
    mins >= 20 ? 'text-destructive' : mins >= 10 ? 'text-amber-600' : 'text-muted-foreground';

  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium tabular-nums', tone)}>
      <ClockIcon className="size-3.5" />
      {mins} min
    </span>
  );
}
