import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

interface Props {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  /** Acento del valor. Por defecto neutro. */
  tone?: 'default' | 'success' | 'primary' | 'destructive';
}

const TONE: Record<NonNullable<Props['tone']>, string> = {
  default: 'text-foreground',
  success: 'text-success',
  primary: 'text-primary',
  destructive: 'text-destructive',
};

/** Tarjeta de KPI. Server component: son solo cifras, no necesitan JavaScript. */
export function StatCard({ label, value, hint, icon, tone = 'default' }: Props) {
  return (
    <Card size="sm">
      <CardContent className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted-foreground truncate text-xs">{label}</p>
          <p className={cn('mt-1 text-2xl font-semibold tabular-nums', TONE[tone])}>
            {value}
          </p>
          {hint && <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p>}
        </div>
        {icon && <div className="text-muted-foreground shrink-0">{icon}</div>}
      </CardContent>
    </Card>
  );
}
