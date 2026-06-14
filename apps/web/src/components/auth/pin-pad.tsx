'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { DeleteIcon, CheckIcon } from 'lucide-react';
import { authApi } from '@/lib/api/auth.api';
import { useAuthStore } from '@/stores/auth.store';
import type { AuthUser } from '@loklflow/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

interface PinPadProps {
  userId: string;
  userName: string;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export function PinPad({ userId, userName }: PinPadProps) {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  function append(digit: string) {
    setPin((p) => (p.length >= 6 ? p : p + digit));
  }

  function backspace() {
    setPin((p) => p.slice(0, -1));
  }

  async function submit() {
    if (pin.length < 4) {
      toast.error('El PIN debe tener al menos 4 dígitos');
      return;
    }
    setLoading(true);
    try {
      const user = await authApi.pinLogin({ userId, pin });
      setUser(user as AuthUser);
      router.push('/waiter');
    } catch {
      toast.error('PIN incorrecto');
      setPin('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-6 py-2 text-center">
        <div className="flex flex-col items-center gap-2">
          <Avatar size="lg">
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {userName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm text-muted-foreground">Bienvenido</p>
            <h2 className="text-lg font-semibold">{userName}</h2>
          </div>
        </div>

        <InputOTP
          maxLength={6}
          value={pin}
          onChange={setPin}
          inputMode="numeric"
          pattern="[0-9]*"
          containerClassName="justify-center"
        >
          <InputOTPGroup>
            {Array.from({ length: 6 }).map((_, i) => (
              <InputOTPSlot key={i} index={i} className="size-11 text-lg" />
            ))}
          </InputOTPGroup>
        </InputOTP>

        <div className="grid w-full max-w-xs grid-cols-3 gap-3">
          {KEYS.map((k) => (
            <Button
              key={k}
              type="button"
              variant="outline"
              size="lg"
              className="h-14 text-lg font-semibold"
              disabled={loading}
              onClick={() => append(k)}
            >
              {k}
            </Button>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="lg"
            className="h-14"
            disabled={loading}
            onClick={backspace}
            aria-label="Borrar"
          >
            <DeleteIcon className="size-5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-14 text-lg font-semibold"
            disabled={loading}
            onClick={() => append('0')}
          >
            0
          </Button>
          <Button
            type="button"
            size="lg"
            className="h-14"
            disabled={loading}
            onClick={submit}
            aria-label="Confirmar"
          >
            <CheckIcon className="size-5" />
          </Button>
        </div>

        <Button
          type="button"
          variant="link"
          size="sm"
          className="text-muted-foreground"
          onClick={() => router.back()}
        >
          ← Cambiar empleado
        </Button>
      </CardContent>
    </Card>
  );
}
