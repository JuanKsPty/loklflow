import { notFound } from 'next/navigation';
import { PinPad } from '@/components/auth/pin-pad';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface OperationalUser {
  id: string;
  name: string;
  /** Solo el nombre del rol: el id es un identificador interno que esta pantalla no usa. */
  role: { name: string };
}

interface Props {
  params: Promise<{ userId: string }>;
}

export default async function PinEntryPage({ params }: Props) {
  const { userId } = await params;
  let user: OperationalUser | null = null;

  try {
    // Se pide **este** usuario, no la plantilla entera para hacer `.find()`: eso eran dos volcados
    // anónimos del personal por cada carga del teclado, para pintar un nombre.
    const res = await fetch(`${BASE_URL}/api/users/operational/${userId}`, { cache: 'no-store' });
    if (res.ok) user = (await res.json()) as OperationalUser;
  } catch {
    // fall through to notFound
  }

  if (!user) notFound();

  return <PinPad userId={user.id} userName={user.name} />;
}
