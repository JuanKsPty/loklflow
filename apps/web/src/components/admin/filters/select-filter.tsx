'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { hrefWith, type UrlParams } from '@/lib/url';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterOptionGroup {
  label: string;
  options: FilterOption[];
}

/**
 * Un desplegable que escribe su valor en la URL.
 *
 * Existe sobre todo por la pestaña de Movimientos, donde hasta ahora la única forma de ver el
 * historial de un producto era **pegar su uuid a mano** en la barra de direcciones. El uuid sigue
 * viajando por debajo —es una clave ajena, no algo que nadie teclee—; lo que cambia es que ahora
 * se elige por su nombre.
 *
 * Sin filtro se navega quitando el parámetro, no poniéndolo a vacío: la URL que se comparte queda
 * limpia y el servidor no tiene que interpretar la cadena vacía.
 */
export function SelectFilter({
  basePath,
  params,
  name,
  label,
  value,
  options,
  groups,
  allLabel = 'Todos',
  className,
}: {
  basePath: string;
  params: UrlParams;
  name: string;
  label: string;
  value?: string;
  options?: FilterOption[];
  /** Alternativa a `options` cuando las opciones vienen de dos sitios distintos. */
  groups?: FilterOptionGroup[];
  allLabel?: string;
  className?: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const TODOS = '__todos__';

  const todas = groups ? groups.flatMap((g) => g.options) : (options ?? []);
  const items = [{ value: TODOS, label: allLabel }, ...todas];

  return (
    <Select
      name={name}
      items={items}
      value={value ?? TODOS}
      onValueChange={(v) => {
        const elegido = v === TODOS ? undefined : String(v);
        startTransition(() => {
          router.replace(hrefWith(basePath, params, { [name]: elegido }), { scroll: false });
        });
      }}
    >
      <SelectTrigger className={className ?? 'w-full sm:w-52'} aria-label={label}>
        <SelectValue placeholder={allLabel} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={TODOS}>{allLabel}</SelectItem>
        {groups
          ? groups
              .filter((g) => g.options.length > 0)
              .map((g) => (
                <SelectGroup key={g.label}>
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    {g.label}
                  </div>
                  {g.options.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))
          : todas.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
      </SelectContent>
    </Select>
  );
}
