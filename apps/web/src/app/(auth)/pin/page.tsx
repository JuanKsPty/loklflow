import Link from 'next/link';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface OperationalUser {
  id: string;
  name: string;
  role: { id: string; name: string };
}

export const metadata = { title: 'Acceso por PIN — LoklFlow' };

export default async function PinSelectPage() {
  let users: OperationalUser[] = [];
  try {
    const res = await fetch(`${BASE_URL}/api/users/operational`, { cache: 'no-store' });
    if (res.ok) users = await res.json() as OperationalUser[];
  } catch {
    // muestra pantalla vacía si la API no está disponible
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Selecciona tu perfil</h1>
        <p className="text-gray-500 text-sm mt-1">¿Quién eres?</p>
      </div>

      {users.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-8">
          No hay empleados con PIN configurado
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {users.map((u) => (
            <Link
              key={u.id}
              href={`/pin/${u.id}`}
              className="flex flex-col items-center justify-center p-4 rounded-xl border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-lg mb-2">
                {u.name.charAt(0).toUpperCase()}
              </div>
              <span className="font-medium text-gray-900 text-sm">{u.name}</span>
              <span className="text-gray-400 text-xs">{u.role.name}</span>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-6 text-center">
        <Link href="/login" className="text-sm text-gray-400 hover:text-gray-600">
          Iniciar sesión con email
        </Link>
      </div>
    </div>
  );
}
