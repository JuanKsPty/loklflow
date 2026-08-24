import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/auth/server-user';
import { landingFor } from '@/lib/auth/landing';

/**
 * La puerta del icono instalado.
 *
 * `start_url` del manifiesto **no puede saber quién abre**: la especificación no admite
 * condicionales y el sistema operativo congela el valor en el momento de instalar, así que quien
 * se instalara la app un día quedaría anclado para siempre a lo que tuviera entonces. Quien decide
 * es el servidor, aquí, con la misma función que ya usa el teclado del PIN.
 *
 * Antes esto mandaba a `/login` sin mirar nada, así que el icono abría la pantalla de acceso
 * teniendo la sesión abierta.
 */
export default async function Home() {
  const user = await getServerUser();
  redirect(user ? landingFor(user.permissions) : '/login');
}
