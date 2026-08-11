'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOutIcon } from 'lucide-react';
import { authApi } from '@/lib/api/auth.api';
import { useAuthStore } from '@/stores/auth.store';
import { usePendingOperations } from '@/lib/offline/use-outbox';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * Cerrar sesión, con una salvaguarda: **no se sale con la cola llena**.
 *
 * El reenvío usa `credentials: 'include'`, así que las operaciones que quedan pendientes se
 * enviarían con la cookie del **siguiente** usuario. `OrdersService.create` escribe `waiterId`
 * con quien firma la petición, y `order_status_history.changed_by` igual: la comanda de un
 * mesero acabaría atribuida a otro, en la bitácora y en el reporte de ventas por mesero. Es
 * una falsificación silenciosa del rastro, y el turno siguiente no tiene forma de notarlo.
 *
 * El aviso no bloquea del todo —a veces hay que salir— pero obliga a verlo y a decir que sí.
 */
export function LogoutButton() {
  const router = useRouter();
  const clearUser = useAuthStore((s) => s.clearUser);
  const pending = usePendingOperations();
  const [asking, setAsking] = useState(false);

  async function logout() {
    try {
      await authApi.logout();
    } catch {
      // ignora errores de red al cerrar sesión
    }
    clearUser();
    router.push('/login');
    router.refresh();
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => (pending.length > 0 ? setAsking(true) : logout())}
        aria-label="Cerrar sesión"
      >
        <LogOutIcon />
      </Button>

      <AlertDialog open={asking} onOpenChange={setAsking}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Quedan {pending.length}{' '}
              {pending.length === 1 ? 'operación sin enviar' : 'operaciones sin enviar'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Si cierras sesión ahora, se enviarán cuando vuelva la conexión pero quedarán a
              nombre de quien entre después. Conéctate y espera a que la cola se vacíe si
              puedes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir aquí</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={logout}>
              Cerrar sesión igualmente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
