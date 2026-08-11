import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const push = vi.fn();
const back = vi.fn();
const pinLogin = vi.fn();
const setUser = vi.fn();
const toastError = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ push, back }) }));
vi.mock('sonner', () => ({ toast: { error: toastError, success: vi.fn() } }));
vi.mock('@/lib/api/auth.api', () => ({ authApi: { pinLogin: (...a: unknown[]) => pinLogin(...a) } }));
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: (selector: (s: { setUser: typeof setUser }) => unknown) => selector({ setUser }),
}));

const { PinPad } = await import('./pin-pad');

/**
 * El teclado del PIN.
 *
 * Es el único componente del repo que decide **a dónde entra cada empleado**, y hasta ahora no
 * lo probaba nada. La tabla de permiso→ruta vive aparte, en `lib/auth/landing.ts`, con su propio
 * spec; aquí se comprueba el resto: que el teclado acumule dígitos, que no deje enviar un PIN
 * corto, que un PIN incorrecto **borre lo tecleado** —si no, el segundo intento arrastra los
 * dígitos del primero y falla siempre— y que la navegación use el destino que corresponde.
 */
describe('PinPad', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const setup = () => render(<PinPad userId="u-1" userName="Ana" />);
  const teclear = (digits: string) => {
    for (const d of digits) fireEvent.click(screen.getByRole('button', { name: d }));
  };
  const confirmar = () => fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

  it('saluda al empleado por su nombre', () => {
    setup();
    expect(screen.getByText('Ana')).toBeTruthy();
  });

  it('un PIN de menos de cuatro dígitos ni siquiera se envía', () => {
    setup();
    teclear('123');
    confirmar();

    expect(pinLogin).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith('El PIN debe tener al menos 4 dígitos');
  });

  it('envía el PIN tecleado y lleva al salón', async () => {
    pinLogin.mockResolvedValue({ id: 'u-1', permissions: ['tables:update'] });
    setup();
    teclear('2846');
    confirmar();

    await waitFor(() => expect(push).toHaveBeenCalledWith('/waiter'));
    expect(pinLogin).toHaveBeenCalledWith({ userId: 'u-1', pin: '2846' });
    expect(setUser).toHaveBeenCalled();
  });

  it('al cajero lo lleva a la caja', async () => {
    pinLogin.mockResolvedValue({ id: 'u-2', permissions: ['pos:create'] });
    setup();
    teclear('5029');
    confirmar();

    await waitFor(() => expect(push).toHaveBeenCalledWith('/pos'));
  });

  it('un PIN incorrecto avisa y deja el campo vacío para el siguiente intento', async () => {
    // Sin el borrado, el segundo intento manda ocho dígitos y falla haga lo que haga el empleado.
    pinLogin.mockRejectedValue(new Error('401'));
    setup();
    teclear('1111');
    confirmar();

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('PIN incorrecto'));
    expect(push).not.toHaveBeenCalled();

    pinLogin.mockResolvedValue({ id: 'u-1', permissions: ['tables:update'] });
    teclear('2846');
    confirmar();

    await waitFor(() => expect(push).toHaveBeenCalledWith('/waiter'));
    expect(pinLogin).toHaveBeenLastCalledWith({ userId: 'u-1', pin: '2846' });
  });

  it('el borrado quita el último dígito', async () => {
    pinLogin.mockResolvedValue({ id: 'u-1', permissions: [] });
    setup();
    teclear('28469');
    fireEvent.click(screen.getByRole('button', { name: 'Borrar' }));
    confirmar();

    await waitFor(() => expect(pinLogin).toHaveBeenCalledWith({ userId: 'u-1', pin: '2846' }));
  });

  it('no acepta más de seis dígitos', () => {
    // El backend acota el PIN a 4–6; dejar teclear un séptimo daría un 400 sin explicación.
    pinLogin.mockResolvedValue({ id: 'u-1', permissions: [] });
    setup();
    teclear('1234567');
    confirmar();

    expect(pinLogin).toHaveBeenCalledWith({ userId: 'u-1', pin: '123456' });
  });

  it('«cambiar empleado» vuelve atrás', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /cambiar empleado/i }));
    expect(back).toHaveBeenCalled();
  });
});
