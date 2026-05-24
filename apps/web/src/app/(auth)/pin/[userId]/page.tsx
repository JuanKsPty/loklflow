import { notFound } from 'next/navigation';
import { PinPad } from '@/components/auth/pin-pad';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface OperationalUser {
  id: string;
  name: string;
  role: { id: string; name: string };
}

interface Props {
  params: Promise<{ userId: string }>;
}

export default async function PinEntryPage({ params }: Props) {
  const { userId } = await params;
  let user: OperationalUser | null = null;

  try {
    const res = await fetch(`${BASE_URL}/api/users/operational`, { cache: 'no-store' });
    if (res.ok) {
      const users = await res.json() as OperationalUser[];
      user = users.find((u) => u.id === userId) ?? null;
    }
  } catch {
    // fall through to notFound
  }

  if (!user) notFound();

  return <PinPad userId={user.id} userName={user.name} />;
}
