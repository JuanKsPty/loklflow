'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UsersIcon } from 'lucide-react';
import type { RestaurantTable, Sector } from '@loklflow/types';
import { cn } from '@/lib/utils';
import {
  TABLE_STATUS_LABELS,
  TABLE_STATUS_MAP_CLASSES,
} from '@/components/admin/tables/constants';

const SECTOR_ACCENTS = ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#8b5cf6', '#ef4444', '#0ea5e9'];
const PAD = 32; // margen alrededor del contenido, en coordenadas del plano
const MAX_SCALE = 1.6; // evita mesas gigantes cuando sobra espacio

function tableSize(capacity: number): number {
  return Math.min(96, Math.max(52, 44 + capacity * 6));
}

interface Pos {
  x: number;
  y: number;
}

/** Posiciones guardadas; las mesas sin posición caen en una rejilla automática. */
function buildPositions(tables: RestaurantTable[]): Record<string, Pos> {
  const result: Record<string, Pos> = {};
  let auto = 0;
  for (const t of tables) {
    if (t.positionX != null && t.positionY != null) {
      result[t.id] = { x: t.positionX, y: t.positionY };
    } else {
      const col = auto % 8;
      const row = Math.floor(auto / 8);
      result[t.id] = { x: 20 + col * 100, y: 20 + row * 100 };
      auto++;
    }
  }
  return result;
}

export function WaiterFloorMap({
  sectors,
  tables,
}: {
  sectors: Sector[];
  tables: RestaurantTable[];
}) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Prefetch de los destinos para que el tap sea instantáneo.
  const active = tables.filter((t) => t.isActive);
  useEffect(() => {
    active.forEach((t) => router.prefetch(`/waiter/mesa/${t.id}`));
  }, [active, router]);

  if (active.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border bg-muted/30">
        <p className="text-sm text-muted-foreground">No hay mesas configuradas todavía.</p>
      </div>
    );
  }

  const positions = buildPositions(active);
  const accentBySector = new Map(sectors.map((s, i) => [s.id, SECTOR_ACCENTS[i % SECTOR_ACCENTS.length]]));

  // Caja de contenido (en coordenadas del plano).
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const t of active) {
    const p = positions[t.id];
    const s = tableSize(t.capacity);
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + s);
    maxY = Math.max(maxY, p.y + s);
  }
  const contentW = maxX - minX + PAD * 2;
  const contentH = maxY - minY + PAD * 2;

  // Escala "contain": llena el área disponible sin recortar ni deformar.
  const scale = box.w && box.h ? Math.min(box.w / contentW, box.h / contentH, MAX_SCALE) : 0;
  const offX = (box.w - contentW * scale) / 2;
  const offY = (box.h - contentH * scale) / 2;
  const toX = (x: number) => offX + (x - minX + PAD) * scale;
  const toY = (y: number) => offY + (y - minY + PAD) * scale;

  // Regiones por sector (delimitación visual).
  const regions = sectors
    .map((s, i) => {
      const items = active.filter((t) => t.sectorId === s.id);
      if (items.length === 0) return null;
      let rMinX = Infinity;
      let rMinY = Infinity;
      let rMaxX = -Infinity;
      let rMaxY = -Infinity;
      for (const t of items) {
        const p = positions[t.id];
        const sz = tableSize(t.capacity);
        rMinX = Math.min(rMinX, p.x);
        rMinY = Math.min(rMinY, p.y);
        rMaxX = Math.max(rMaxX, p.x + sz);
        rMaxY = Math.max(rMaxY, p.y + sz);
      }
      const rp = 16;
      return {
        id: s.id,
        name: s.name,
        accent: SECTOR_ACCENTS[i % SECTOR_ACCENTS.length],
        x: rMinX - rp,
        y: rMinY - rp,
        w: rMaxX - rMinX + rp * 2,
        h: rMaxY - rMinY + rp * 2,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  return (
    <div ref={ref} className="relative h-full w-full overflow-hidden rounded-xl border bg-muted/30">
      {scale > 0 && (
        <>
          {regions.map((r) => (
            <div
              key={r.id}
              className="pointer-events-none absolute rounded-2xl border-2 border-dashed"
              style={{
                left: toX(r.x),
                top: toY(r.y),
                width: r.w * scale,
                height: r.h * scale,
                borderColor: `${r.accent}66`,
                backgroundColor: `${r.accent}0f`,
              }}
            >
              <span
                className="absolute -top-2.5 left-3 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
                style={{ backgroundColor: r.accent }}
              >
                {r.name}
              </span>
            </div>
          ))}

          {active.map((t) => {
            const p = positions[t.id];
            const size = tableSize(t.capacity) * scale;
            const accent = accentBySector.get(t.sectorId);
            const shapeClass = t.shape === 'round' ? 'rounded-full' : 'rounded-lg';
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => router.push(`/waiter/mesa/${t.id}`)}
                className={cn(
                  'absolute z-10 flex flex-col items-center justify-center gap-0.5 border-2 text-center transition-shadow hover:shadow-md active:scale-95',
                  shapeClass,
                  TABLE_STATUS_MAP_CLASSES[t.status],
                )}
                style={{ left: toX(p.x), top: toY(p.y), width: size, height: size }}
                aria-label={`Mesa ${t.number} — ${TABLE_STATUS_LABELS[t.status]}`}
              >
                <span
                  className="absolute left-1 top-1 size-2 rounded-full"
                  style={{ backgroundColor: accent }}
                  aria-hidden
                />
                <span className="font-bold leading-none" style={{ fontSize: Math.max(12, size * 0.3) }}>
                  {t.number}
                </span>
                <span
                  className="flex items-center gap-0.5 leading-none opacity-80"
                  style={{ fontSize: Math.max(9, size * 0.17) }}
                >
                  <UsersIcon style={{ width: size * 0.18, height: size * 0.18 }} />
                  {t.capacity}
                </span>
              </button>
            );
          })}
        </>
      )}
    </div>
  );
}
