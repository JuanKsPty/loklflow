import type { BusinessConfig } from '@loklflow/types';
import { serverFetch } from '@/lib/api/server-client';
import { PageHeader } from '@/components/page-header';
import { BusinessConfigForm } from '@/components/admin/business-config-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = { title: 'Configuración — LoklFlow' };

export default async function SettingsPage() {
  let config: BusinessConfig | null = null;
  try {
    config = await serverFetch<BusinessConfig>('/business-config');
  } catch {
    // se muestra el aviso de abajo si la API no responde
  }

  return (
    <div>
      <PageHeader
        title="Configuración del negocio"
        description="Datos del establecimiento, moneda, zona horaria e impuesto del recibo."
      />

      {config ? (
        <BusinessConfigForm config={config} />
      ) : (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>No se pudo cargar la configuración</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Comprueba que la API esté disponible y vuelve a cargar la página.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
