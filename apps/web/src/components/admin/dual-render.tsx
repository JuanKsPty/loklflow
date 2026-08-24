import type React from 'react';

/**
 * Los dos lados de un listado del panel: tarjetas en el teléfono, tabla a partir de `sm`.
 *
 * Existen para que el escalón esté escrito **en un solo sitio** y no pueda derivar entre los trece
 * listados. `sm` (640 px) es el mismo de `design-system.md` §4, y el que ya usaban
 * `order-table.tsx` y `page-header.tsx`.
 *
 * Sin `'use client'` a propósito: los listados son Server Components y por aquí solo pasa JSX, que
 * sí cruza la frontera —una prop de tipo función no lo haría—.
 */
export function CardList({ children }: { children: React.ReactNode }) {
  return <ul className="flex flex-col gap-3 sm:hidden">{children}</ul>;
}

/**
 * El marco de la tabla de siempre. `rounded-xl border` es exactamente lo que llevaba cada listado
 * antes, y `sm:block` es el `display` que ya tenía: a partir de 640 px no cambia ni un píxel.
 */
export function TableFrame({ children }: { children: React.ReactNode }) {
  return <div className="hidden rounded-xl border sm:block">{children}</div>;
}
