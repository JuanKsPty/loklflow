import type { PublicBusiness, PublicTable } from '@loklflow/types';

/**
 * La cabecera del menú del cliente.
 *
 * **No usa `PageHeader`**, y la desviación es a propósito: esa primitiva está pensada para el panel
 * de administración —título a la izquierda, acciones a la derecha, densidad de escritorio— y aquí
 * lo que hace falta es lo contrario. Es la primera pantalla que ve alguien que acaba de escanear un
 * papel: tiene que confirmarle en un segundo que está en el sitio correcto y en su mesa, centrado y
 * grande, sin ninguna acción compitiendo por su atención.
 */
export function QrBrandHeader({
  business,
  table,
}: {
  business: PublicBusiness;
  table: PublicTable;
}) {
  return (
    <header className="flex flex-col items-center gap-2 border-b px-4 py-6 text-center">
      {business.logoUrl ? (
        // `<img>` y no `next/image`: la URL la escribe el negocio en su configuración y puede
        // apuntar a cualquier host, así que el optimizador de Next la rechazaría salvo que se
        // declararan todos los dominios posibles por adelantado.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={business.logoUrl}
          alt={business.name}
          className="h-12 w-auto max-w-[60%] object-contain"
        />
      ) : (
        <h1 className="text-xl font-semibold tracking-tight">{business.name}</h1>
      )}
      <p className="text-sm text-muted-foreground">
        Mesa {table.number}
        {table.sectorName && ` · ${table.sectorName}`}
      </p>
    </header>
  );
}
