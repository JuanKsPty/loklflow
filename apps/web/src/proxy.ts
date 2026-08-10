import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';

// /waiter estaba fuera de la lista: quedaba cubierto solo por el redirect del layout
// de servidor, sin defensa en profundidad, y es la superficie con más rutas de la app.
const PROTECTED_PREFIXES = ['/admin', '/orders', '/kitchen', '/pos', '/waiter'];

function isProtected(pathname: string) {
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
