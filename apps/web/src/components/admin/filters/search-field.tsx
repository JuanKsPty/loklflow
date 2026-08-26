'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { SearchIcon, XIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { hrefWith, type UrlParams } from '@/lib/url';

/** Lo bastante corto para sentirse inmediato y lo bastante largo para no ir letra a letra. */
const DEBOUNCE_MS = 300;

/**
 * La caja de búsqueda de los listados del panel.
 *
 * Navega con `router.replace` y no enviando el formulario, y la diferencia importa: un envío GET
 * nativo es una navegación **dura**, que vuelve a montar la página entera y **se lleva el foco y
 * el cursor** — escribiendo a 300 ms por tecla, la caja se quedaría vacía y desenfocada a mitad de
 * palabra. `router.replace` es una navegación suave: este componente no se vuelve a montar, así
 * que el foco, el cursor y la selección siguen donde estaban. Sin JavaScript el formulario se
 * envía nativo, que es lo que se quiere justo ahí.
 *
 * El valor lo lleva un `useState` sembrado **una sola vez**. Volver a sembrarlo desde las props en
 * cada render devolvería el cursor al final cada vez que llega la respuesta del servidor.
 */
export function SearchField({
  basePath,
  params,
  name = 'q',
  defaultValue = '',
  placeholder,
  label,
}: {
  basePath: string;
  /** Los filtros que ya están puestos; se conservan al escribir. */
  params: UrlParams;
  name?: string;
  defaultValue?: string;
  placeholder: string;
  /** Se usa como `aria-label`: la barra no tiene sitio para una etiqueta visible. */
  label: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const navegar = (termino: string) => {
    if (timer.current) clearTimeout(timer.current);
    startTransition(() => {
      // `undefined` y no '': así la URL que se comparte no arrastra un `?q=` vacío.
      router.replace(hrefWith(basePath, params, { [name]: termino.trim() || undefined }), {
        scroll: false,
      });
    });
  };

  const alEscribir = (termino: string) => {
    setValue(termino);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => navegar(termino), DEBOUNCE_MS);
  };

  // Sin esto, salir de la pantalla con una tecla recién pulsada dispara una navegación sobre una
  // ruta que ya no está montada.
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  return (
    <div className="relative w-full sm:w-64">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
        {pending ? <Spinner className="size-4" /> : <SearchIcon className="size-4" />}
      </span>
      <Input
        type="search"
        name={name}
        value={value}
        onChange={(e) => alEscribir(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          // Con JavaScript, Enter no debe enviar el formulario: sería la navegación dura que este
          // componente existe para evitar. Se adelanta al debounce y navega ya.
          e.preventDefault();
          navegar(value);
        }}
        placeholder={placeholder}
        aria-label={label}
        className="pl-9"
      />
      {value !== '' && (
        <button
          // `type="button"`, o dentro de un formulario sería un botón de envío.
          type="button"
          onClick={() => {
            setValue('');
            navegar('');
          }}
          aria-label="Limpiar la búsqueda"
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <XIcon className="size-4" />
        </button>
      )}
    </div>
  );
}
