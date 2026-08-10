import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';

// /waiter estaba fuera de la lista: quedaba cubierto solo por el redirect del layout
// de servidor, sin defensa en profundidad, y es la superficie con más rutas de la app.
const PROTECTED_PREFIXES = ['/admin', '/orders', '/kitchen', '/pos', '/waiter'];

/**
 * Rutas que **tienen** que quedar abiertas: el menú y el pedido desde el QR del cliente.
 *
 * Hoy pasarían igual, porque no empiezan por ningún prefijo protegido, así que esto no arregla
 * nada — **blinda**. La lista de arriba va a crecer, y el día que alguien añada un prefijo que
 * empiece por `/m` (`/menu`, `/mesa`…) el cliente que escanea un papel acabaría en el formulario de
 * acceso del personal, con un campo de email, y nadie relacionaría las dos cosas. La salida
 * temprana y su spec convierten eso en un test rojo en lugar de en una llamada del dueño.
 */
const PUBLIC_PREFIXES = ['/m'];

/** Funciones puras para poder probarlas sin montar Next. */
export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function isProtected(pathname: string): boolean {
  if (isPublicPath(pathname)) return false;
  return PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isProtected(pathname)) return NextResponse.next();

  const token = request.cookies.get('access_token')?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (await verifyToken(token)) return NextResponse.next();

  const response = NextResponse.redirect(new URL('/login', request.url));
  response.cookies.delete('access_token');
  return response;
}

export const config = {
  // `sw.js`, el manifiesto y los iconos quedan fuera del matcher. Hoy pasarían igual —no
  // empiezan por ningún prefijo protegido—, así que esto es blindaje, no arreglo: el día que
  // alguien añada un prefijo nuevo a `PROTECTED_PREFIXES`, el Service Worker no puede acabar
  // recibiendo un 307 hacia `/login`. Un SW que se sirve como redirección no se registra, y el
  // modo sin conexión desaparecería sin un solo error en consola.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|icons/|api).*)'],
};
