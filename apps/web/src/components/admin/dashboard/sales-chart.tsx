'use client';

import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts';
import type { SalesByDay } from '@loklflow/types';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { formatPrice } from '@/lib/format';

// Los tokens --chart-1..5 ya existían en globals.css antes de instalar el gráfico.
const config = {
  total: { label: 'Ventas', color: 'var(--chart-1)' },
} satisfies ChartConfig;

/** Cliente porque Recharts mide el contenedor en el navegador. */
export function SalesChart({ data }: { data: SalesByDay[] }) {
  const rows = data.map((d) => ({
    ...d,
    // Etiqueta corta: "04 mar" en lugar de la fecha ISO completa.
    label: new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short' }).format(
      new Date(`${d.day}T12:00:00`),
    ),
  }));

  return (
    <ChartContainer config={config} className="h-[220px] w-full">
      <BarChart accessibilityLayer data={rows} margin={{ top: 12 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              formatter={(value) => formatPrice(Number(value))}
              labelFormatter={(label) => String(label)}
            />
          }
        />
        <Bar dataKey="total" fill="var(--color-total)" radius={6} />
      </BarChart>
    </ChartContainer>
  );
}
