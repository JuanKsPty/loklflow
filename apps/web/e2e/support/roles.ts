/**
 * Los roles del e2e y dónde queda guardada la sesión de cada uno.
 *
 * En un archivo aparte de `auth.setup.ts` por una regla de Playwright que no es negociable: un
 * spec no puede importar de otro archivo de test, y el setup lo es. Aquí no hay `test()`, solo
 * datos.
 *
 * Los PIN son los del seed de desarrollo. Cambiaron de `1234/5678/4321` a `2846/9173/5029` cuando
 * entró la política de PIN, que rechaza exactamente los primeros.
 */

export const AUTH_DIR = 'e2e/.auth';

export interface Rol {
  /** Nombre con el que el seed lo crea; es como se elige en el roster del PIN pad. */
  perfil: string;
  file: string;
  pin?: string;
  /** Pantalla donde debe aterrizar al entrar. Lo decide `lib/auth/landing.ts`. */
  landing: string;
}

export const ROLES: Record<'mesero' | 'cocina' | 'cajero' | 'admin', Rol> = {
  mesero: {
    perfil: 'Mesero Demo',
    file: `${AUTH_DIR}/mesero.json`,
    pin: '2846',
    landing: '/waiter',
  },
  cocina: {
    perfil: 'Cocina Demo',
    file: `${AUTH_DIR}/cocina.json`,
    pin: '9173',
    landing: '/kitchen',
  },
  cajero: {
    perfil: 'Cajero Demo',
    file: `${AUTH_DIR}/cajero.json`,
    pin: '5029',
    landing: '/pos',
  },
  admin: {
    perfil: 'Administrador',
    file: `${AUTH_DIR}/admin.json`,
    landing: '/admin',
  },
};
