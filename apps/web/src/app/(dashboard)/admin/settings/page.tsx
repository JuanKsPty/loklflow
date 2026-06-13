import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export const metadata = { title: 'Configuración — LoklFlow' };

export default function SettingsPage() {
  return (
    <div>
      <PageHeader title="Configuración del negocio" description="Datos generales, moneda y zona horaria." />

      <Tabs defaultValue="general" className="max-w-2xl">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="regional">Regional</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>Información del negocio</CardTitle>
              <CardDescription>Nombre, logo y datos de contacto del establecimiento.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Esta sección se conectará al módulo de configuración del negocio en la próxima iteración.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="regional">
          <Card>
            <CardHeader>
              <CardTitle>Moneda y zona horaria</CardTitle>
              <CardDescription>Define la moneda (MXN) y la zona horaria de operación.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Esta sección se conectará al módulo de configuración del negocio en la próxima iteración.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
