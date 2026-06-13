import Link from 'next/link';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { UsersIcon } from 'lucide-react';

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
    if (res.ok) users = (await res.json()) as OperationalUser[];
  } catch {
    // muestra pantalla vacía si la API no está disponible
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Selecciona tu perfil</CardTitle>
        <CardDescription>¿Quién eres?</CardDescription>
      </CardHeader>
      <CardContent>
        {users.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UsersIcon />
              </EmptyMedia>
              <EmptyTitle>Sin empleados con PIN</EmptyTitle>
              <EmptyDescription>No hay empleados con PIN configurado todavía.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {users.map((u) => (
              <Link
                key={u.id}
                href={`/pin/${u.id}`}
                className="flex flex-col items-center justify-center gap-2 rounded-xl border p-4 transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                <Avatar size="lg">
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {u.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">{u.name}</span>
                <span className="text-xs text-muted-foreground">{u.role.name}</span>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter className="justify-center">
        <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
          Iniciar sesión con email
        </Link>
      </CardFooter>
    </Card>
  );
}
