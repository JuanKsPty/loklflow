import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

/** Encabezado canónico de página: título + descripción opcional + acción a la derecha. */
export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    // Apilado en móvil: con la acción al lado, un título de dos palabras y un botón de 44 px
    // no caben en 390 px y el encabezado se comprime hasta partir la palabra.
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="space-y-1">
        <h1 className="font-heading text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
