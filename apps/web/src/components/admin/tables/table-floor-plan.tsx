'use client';

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  UsersIcon,
  LayoutGridIcon,
  PencilIcon,
  SaveIcon,
  XIcon,
  PlusIcon,
  MinusIcon,
  MoveIcon,
} from 'lucide-react';
import {
  TABLE_STATUSES,
  type RestaurantTable,
  type Sector,
  type TableShape,
  type TableStatus,
} from '@loklflow/types';
import { tablesApi } from '@/lib/api/tables.api';
import { TABLE_STATUS_LABELS, TABLE_STATUS_MAP_CLASSES } from './constants';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';

const DEFAULT_W = 1280;
const DEFAULT_H = 760;
const STEP = 240;
const MIN_SIZE = 640;
const MAX_SIZE = 4000;
const GRID = 20;
const SECTOR_ACCENTS = ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#8b5cf6', '#ef4444', '#0ea5e9'];
const STORAGE_KEY = 'lokl_floor_canvas';

interface Pos {
  x: number;
  y: number;
  shape: TableShape;
}

interface Props {
  sectors: Sector[];
  tables: RestaurantTable[];
  canEdit: boolean;
}

function tableSize(capacity: number): number {
  return Math.min(96, Math.max(52, 44 + capacity * 6));
}

const snap = (v: number) => Math.round(v / GRID) * GRID;
const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v));

function buildPositions(tables: RestaurantTable[]): Record<string, Pos> {
  const result: Record<string, Pos> = {};
  let auto = 0;
  for (const t of tables) {
    if (t.positionX != null && t.positionY != null) {
      result[t.id] = { x: t.positionX, y: t.positionY, shape: t.shape };
    } else {
      const col = auto % 8;
      const row = Math.floor(auto / 8);
      result[t.id] = { x: 20 + col * 100, y: 20 + row * 100, shape: t.shape };
      auto++;
    }
  }
  return result;
}

export function TableFloorPlan({ sectors, tables, canEdit }: Props) {
  const router = useRouter();
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const groupDragRef = useRef<{
    startX: number;
    startY: number;
    snapshot: Record<string, { x: number; y: number }>;
  } | null>(null);
  const dimsRef = useRef<{ w: number; h: number }>({ w: DEFAULT_W, h: DEFAULT_H });

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [activeZone, setActiveZone] = useState<string>('all');
  const [positions, setPositions] = useState<Record<string, Pos>>(() => buildPositions(tables));
  const [userSize, setUserSize] = useState<{ w: number; h: number }>({ w: DEFAULT_W, h: DEFAULT_H });

  // Carga el tamaño guardado del lienzo (solo cliente).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.w && parsed?.h) setUserSize({ w: parsed.w, h: parsed.h });
      }
    } catch {
      // ignora
    }
  }, []);

  // Resincroniza con el servidor cuando no se está editando (p. ej. tras guardar y refrescar).
  useEffect(() => {
    if (!editing) setPositions(buildPositions(tables));
  }, [tables, editing]);

  function persistSize(w: number, h: number) {
    setUserSize({ w, h });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ w, h }));
    } catch {
      // ignora
    }
  }

  const accentBySector = new Map(sectors.map((s, i) => [s.id, SECTOR_ACCENTS[i % SECTOR_ACCENTS.length]]));
  const tableById = new Map(tables.map((t) => [t.id, t]));
  const visibleTables = tables.filter((t) => activeZone === 'all' || t.sectorId === activeZone);

  // Tamaño efectivo: el mayor entre el elegido por el usuario y el necesario para no recortar mesas.
  let contentW = MIN_SIZE;
  let contentH = MIN_SIZE;
  for (const t of visibleTables) {
    const p = positions[t.id];
    if (!p) continue;
    const sz = tableSize(t.capacity);
    contentW = Math.max(contentW, p.x + sz + 40);
    contentH = Math.max(contentH, p.y + sz + 40);
  }
  const canvasW = Math.max(userSize.w, contentW);
  const canvasH = Math.max(userSize.h, contentH);
  dimsRef.current = { w: canvasW, h: canvasH };

  // Regiones (delimitación visual) por sector, a partir de las mesas visibles.
  const regions = sectors
    .map((s, i) => {
      const items = visibleTables.filter((t) => t.sectorId === s.id);
      if (items.length === 0) return null;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const t of items) {
        const p = positions[t.id];
        const sz = tableSize(t.capacity);
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x + sz);
        maxY = Math.max(maxY, p.y + sz);
      }
      const pad = 26;
      const accent = SECTOR_ACCENTS[i % SECTOR_ACCENTS.length];
      return {
        id: s.id,
        name: s.name,
        accent,
        x: Math.max(0, minX - pad),
        y: Math.max(0, minY - pad),
        w: maxX - minX + pad * 2,
        h: maxY - minY + pad * 2,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  async function changeStatus(table: RestaurantTable, status: TableStatus) {
    if (status === table.status) return;
    setPendingId(table.id);
    try {
      await tablesApi.updateStatus(table.id, status);
      toast.success(`Mesa ${table.number}: ${TABLE_STATUS_LABELS[status]}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cambiar el estado');
    } finally {
      setPendingId(null);
    }
  }

  function onPointerDown(e: ReactPointerEvent, table: RestaurantTable) {
    if (!editing) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const node = positions[table.id];
    const rect = canvasRef.current!.getBoundingClientRect();
    dragRef.current = {
      id: table.id,
      offsetX: e.clientX - rect.left - node.x,
      offsetY: e.clientY - rect.top - node.y,
    };
  }

  function onPointerMove(e: ReactPointerEvent, table: RestaurantTable) {
    const drag = dragRef.current;
    if (!drag || drag.id !== table.id) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const size = tableSize(table.capacity);
    const x = clamp(snap(e.clientX - rect.left - drag.offsetX), dimsRef.current.w - size);
    const y = clamp(snap(e.clientY - rect.top - drag.offsetY), dimsRef.current.h - size);
    setPositions((prev) => ({ ...prev, [table.id]: { ...prev[table.id], x, y } }));
  }

  function onPointerUp(table: RestaurantTable) {
    if (dragRef.current?.id === table.id) dragRef.current = null;
  }

  // Arrastre por sector: mover todas las mesas de una zona a la vez desde su etiqueta.
  function onGroupPointerDown(e: ReactPointerEvent, sectorId: string) {
    if (!editing) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const snapshot: Record<string, { x: number; y: number }> = {};
    for (const t of tables) {
      if (t.sectorId === sectorId) snapshot[t.id] = { x: positions[t.id].x, y: positions[t.id].y };
    }
    groupDragRef.current = { startX: e.clientX, startY: e.clientY, snapshot };
  }

  function onGroupPointerMove(e: ReactPointerEvent) {
    const g = groupDragRef.current;
    if (!g) return;
    const ids = Object.keys(g.snapshot);
    // delta permitido para que NINGUNA mesa del grupo se salga del lienzo
    let minDx = -Infinity;
    let maxDx = Infinity;
    let minDy = -Infinity;
    let maxDy = Infinity;
    for (const id of ids) {
      const t = tableById.get(id);
      if (!t) continue;
      const size = tableSize(t.capacity);
      const { x, y } = g.snapshot[id];
      minDx = Math.max(minDx, -x);
      maxDx = Math.min(maxDx, dimsRef.current.w - size - x);
      minDy = Math.max(minDy, -y);
      maxDy = Math.min(maxDy, dimsRef.current.h - size - y);
    }
    const dx = Math.min(Math.max(snap(e.clientX - g.startX), minDx), maxDx);
    const dy = Math.min(Math.max(snap(e.clientY - g.startY), minDy), maxDy);
    setPositions((prev) => {
      const next = { ...prev };
      for (const id of ids) {
        next[id] = { ...prev[id], x: g.snapshot[id].x + dx, y: g.snapshot[id].y + dy };
      }
      return next;
    });
  }

  function onGroupPointerUp() {
    groupDragRef.current = null;
  }

  function toggleShape(id: string) {
    setPositions((prev) => ({
      ...prev,
      [id]: { ...prev[id], shape: prev[id].shape === 'round' ? 'square' : 'round' },
    }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await tablesApi.saveLayout({
        positions: tables.map((t) => ({
          id: t.id,
          positionX: positions[t.id].x,
          positionY: positions[t.id].y,
          shape: positions[t.id].shape,
        })),
      });
      toast.success('Distribución guardada');
      setEditing(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar la distribución');
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setPositions(buildPositions(tables));
    setEditing(false);
  }

  if (tables.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LayoutGridIcon />
          </EmptyMedia>
          <EmptyTitle>Sin mesas</EmptyTitle>
          <EmptyDescription>Crea sectores y mesas para diseñar la distribución.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Barra de herramientas: filtro de zonas + acciones */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <ZoneChip label="Todas" active={activeZone === 'all'} onClick={() => setActiveZone('all')} />
          {sectors.map((s) => (
            <ZoneChip
              key={s.id}
              label={s.name}
              color={accentBySector.get(s.id)}
              active={activeZone === s.id}
              onClick={() => setActiveZone(s.id)}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Control de tamaño del lienzo */}
          <div className="flex items-center gap-1 rounded-md border px-1 py-0.5 text-xs text-muted-foreground">
            <span className="px-1">Lienzo</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6"
              title="Reducir"
              onClick={() => persistSize(Math.max(MIN_SIZE, canvasW - STEP), Math.max(MIN_SIZE, canvasH - STEP))}
            >
              <MinusIcon />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6"
              title="Ampliar"
              onClick={() => persistSize(Math.min(MAX_SIZE, canvasW + STEP), Math.min(MAX_SIZE, canvasH + STEP))}
            >
              <PlusIcon />
            </Button>
          </div>

          {canEdit &&
            (editing ? (
              <>
                <Button variant="ghost" size="sm" onClick={handleCancel} disabled={saving}>
                  <XIcon />
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  <SaveIcon />
                  {saving ? 'Guardando…' : 'Guardar distribución'}
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <PencilIcon />
                Editar distribución
              </Button>
            ))}
        </div>
      </div>

      {editing && (
        <p className="text-xs text-muted-foreground">
          Arrastra las mesas para ubicarlas. Usa el botón de la esquina de cada mesa para alternar su forma.
          Si te quedas sin espacio, amplía el lienzo con los controles de arriba.
        </p>
      )}

      {/* Lienzo */}
      <div className="overflow-auto rounded-xl border bg-muted/30">
        <div
          ref={canvasRef}
          className="relative"
          style={{
            width: canvasW,
            height: canvasH,
            backgroundSize: `${GRID}px ${GRID}px`,
            backgroundImage:
              'linear-gradient(to right, color-mix(in oklab, var(--color-border) 50%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--color-border) 50%, transparent) 1px, transparent 1px)',
          }}
        >
          {/* Regiones de sector (delimitación visual) */}
          {regions.map((r) => (
            <div
              key={r.id}
              className="pointer-events-none absolute rounded-2xl border-2 border-dashed"
              style={{
                left: r.x,
                top: r.y,
                width: r.w,
                height: r.h,
                borderColor: `${r.accent}66`,
                backgroundColor: `${r.accent}0f`,
              }}
            >
              <span
                className={`absolute -top-2.5 left-3 flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white ${
                  editing ? 'pointer-events-auto cursor-grab touch-none select-none active:cursor-grabbing' : ''
                }`}
                style={{ backgroundColor: r.accent }}
                title={editing ? 'Arrastra para mover toda la zona' : undefined}
                onPointerDown={editing ? (e) => onGroupPointerDown(e, r.id) : undefined}
                onPointerMove={editing ? onGroupPointerMove : undefined}
                onPointerUp={editing ? onGroupPointerUp : undefined}
              >
                {editing && <MoveIcon className="size-3" />}
                {r.name}
              </span>
            </div>
          ))}

          {visibleTables.map((table) => {
            const pos = positions[table.id];
            const size = tableSize(table.capacity);
            const accent = accentBySector.get(table.sectorId);
            const shapeClass = pos.shape === 'round' ? 'rounded-full' : 'rounded-lg';
            const base = `absolute flex flex-col items-center justify-center gap-0.5 border-2 text-center transition-shadow ${shapeClass} ${TABLE_STATUS_MAP_CLASSES[table.status]}`;

            const inner = (
              <>
                <span
                  className="absolute left-1 top-1 size-2 rounded-full"
                  style={{ backgroundColor: accent }}
                  aria-hidden
                />
                <span className="text-base font-bold leading-none">{table.number}</span>
                <span className="flex items-center gap-0.5 text-[11px] leading-none">
                  <UsersIcon className="size-3" />
                  {table.capacity}
                </span>
              </>
            );

            if (editing) {
              return (
                <div
                  key={table.id}
                  className={`${base} z-10 cursor-grab touch-none select-none active:cursor-grabbing`}
                  style={{ left: pos.x, top: pos.y, width: size, height: size }}
                  onPointerDown={(e) => onPointerDown(e, table)}
                  onPointerMove={(e) => onPointerMove(e, table)}
                  onPointerUp={() => onPointerUp(table)}
                >
                  {inner}
                  <button
                    type="button"
                    title="Alternar forma"
                    className="absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full border bg-background text-[10px] shadow-sm"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleShape(table.id);
                    }}
                  >
                    {pos.shape === 'round' ? '◻' : '◯'}
                  </button>
                </div>
              );
            }

            return (
              <DropdownMenu key={table.id}>
                <DropdownMenuTrigger
                  disabled={pendingId === table.id}
                  className={`${base} z-10 cursor-pointer hover:shadow-md disabled:opacity-50`}
                  style={{ left: pos.x, top: pos.y, width: size, height: size }}
                >
                  {inner}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Mesa {table.number} — cambiar estado</DropdownMenuLabel>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  {TABLE_STATUSES.map((status) => (
                    <DropdownMenuItem
                      key={status}
                      disabled={status === table.status}
                      onClick={() => changeStatus(table, status)}
                    >
                      {TABLE_STATUS_LABELS[status]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ZoneChip({
  label,
  color,
  active,
  onClick,
}: {
  label: string;
  color?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'
      }`}
    >
      {color && <span className="size-2 rounded-full" style={{ backgroundColor: color }} aria-hidden />}
      {label}
    </button>
  );
}
