import { serverFetch } from '@/lib/api/server-client';
import type { Role } from '@loklflow/types';

export const metadata = { title: 'Roles — LoklFlow' };

export default async function RolesPage() {
  let roles: Role[] = [];
  try {
    roles = await serverFetch<Role[]>('/roles');
  } catch {
    // muestra tabla vacía si la API no está disponible
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold text-gray-900">Roles</h1>
        <a
          href="/admin/roles/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          + Nuevo rol
        </a>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {roles.length === 0 ? (
          <p className="text-center text-gray-400 py-12">No hay roles registrados</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Nombre</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Descripción</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Desc. máx.</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {roles.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.name}</td>
                  <td className="px-4 py-3 text-gray-500">{r.description ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{r.maxDiscountPercentage}%</td>
                  <td className="px-4 py-3">
                    {r.isSystem && (
                      <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full">
                        Sistema
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a href={`/admin/roles/${r.id}`} className="text-blue-600 hover:underline text-xs">
                      Editar
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
