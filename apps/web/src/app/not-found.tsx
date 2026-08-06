import Link from 'next/link';
import { SearchXIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Lo que se ve cuando algo de verdad no existe.
 *
 * Sin este archivo Next pinta su `HTTPAccessErrorFallback`, que trae un `<style>` en línea con
 * `body{color:#000;background:#fff}`: **pisa el tema**, así que en modo oscuro sale un blanco
 * cegador, y encima el texto está en inglés en una aplicación con `lang="es"`.
 *
 * Ojo con quién llega aquí: desde el bloque 1, las páginas de mesa, orden y cuenta solo llaman
 * a `notFound()` cuando el servidor responde 404 de verdad. Si la API no contesta muestran el
 * aviso de sin conexión, que es otra cosa.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <SearchXIcon className="size-10 text-muted-foreground" />
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Esto no existe</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          La mesa, la cuenta o la página que buscas ya no está. Puede que se haya cerrado o
          que el enlace sea antiguo.
        </p>
      </div>
      <Button variant="outline" nativeButton={false} render={<Link href="/" />}>
        Ir al inicio
      </Button>
    </div>
  );
}
