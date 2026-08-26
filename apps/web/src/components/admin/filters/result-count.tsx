/**
 * Cuántas filas se están viendo.
 *
 * `aria-live` porque con la búsqueda al teclear la tabla cambia sin que nada anuncie el cambio:
 * quien usa un lector de pantalla se quedaría escribiendo sin saber si quedan diez filas o cero.
 *
 * `capped` es para los listados con tope del servidor. La regla de la casa es que **un tope se
 * dice**: sin el aviso, «100 movimientos» se lee como «esto es todo lo que ha pasado».
 */
export function ResultCount({
  shown,
  total,
  noun = 'resultados',
  capped = false,
}: {
  shown: number;
  /** Sin filtros, el total. Si no se conoce, se omite y solo se dice cuántos se ven. */
  total?: number;
  noun?: string;
  capped?: boolean;
}) {
  const filtrado = total !== undefined && shown !== total;
  return (
    <p className="text-sm text-muted-foreground tabular-nums" aria-live="polite" role="status">
      {filtrado ? `${shown} de ${total} ${noun}` : `${shown} ${noun}`}
      {capped && ' · mostrando los más recientes'}
    </p>
  );
}
