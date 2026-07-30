'use client';

import { Bar, BarChart, LabelList, XAxis, YAxis } from 'recharts';
import type { PaymentMethod } from '@loklflow/types';
import { PAYMENT_METHOD_LABELS } from '@loklflow/types';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { formatPrice } from '@/lib/format';

const config = {
  total: { label: 'Cobrado', color: 'var(--chart-2)' },
  label: { color: 'var(--background)' },
} satisfies ChartConfig;

interface Props {
  byMethod: Record<PaymentMethod, number>;
}

/** Barras horizontales por método de pago. */
export function MethodChart({ byMethod }: Props) {
  const rows = (Object.keys(byMethod) as PaymentMethod[])
    .map((m) => ({ method: PAYMENT_METHOD_LABELS[m] ?? m, total: byMethod[m] }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        Sin cobros en el periodo.
      </p>
    );
  }

  return (
    <ChartContainer config={config} className="h-[220px] w-full">
      <BarChart accessibilityLayer data={rows} layout="vertical" margin={{ right: 56 }}>
        <YAxis dataKey="method" type="category" hide />
        <XAxis dataKey="total" type="number" hide />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              indicator="line"
              formatter={(value) => formatPrice(Number(value))}
            />
          }
        />
        <Bar dataKey="total" fill="var(--color-total)" radius={4}>
          <LabelList
            dataKey="method"
            position="insideLeft"
            offset={8}
            className="fill-(--color-label)"
            fontSize={12}
          />
          <LabelList
            dataKey="total"
            position="right"
            offset={8}
            className="fill-foreground"
            fontSize={12}
            formatter={(value: React.ReactNode) => formatPrice(Number(value))}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
