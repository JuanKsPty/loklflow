'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api/auth.api';
import { useAuthStore } from '@/stores/auth.store';
import type { AuthUser } from '@loklflow/types';

interface PinPadProps {
  userId: string;
  userName: string;
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓'];

export function PinPad({ userId, userName }: PinPadProps) {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleDigit(digit: string) {
    if (digit === '⌫') {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (digit === '✓') {
      void submit();
      return;
    }
    if (pin.length >= 6) return;
    setPin((p) => p + digit);
  }

  async function submit() {
    if (pin.length < 4) {
      setError('PIN debe tener al menos 4 dígitos');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const user = await authApi.pinLogin({ userId, pin });
      setUser(user as AuthUser);
      router.push('/orders');
    } catch {
      setError('PIN incorrecto');
      setPin('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
      <p className="text-gray-500 text-sm mb-1">Bienvenido</p>
      <h2 className="text-xl font-bold text-gray-900 mb-6">{userName}</h2>

      <div className="flex justify-center gap-3 mb-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full border-2 transition-colors ${
              i < pin.length ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
            }`}
          />
        ))}
      </div>

      {error && (
        <p className="text-red-500 text-sm mb-4">{error}</p>
      )}

      <div className="grid grid-cols-3 gap-3">
        {DIGITS.map((d) => (
          <button
            key={d}
            onClick={() => handleDigit(d)}
            disabled={loading}
            className={`h-14 rounded-xl text-lg font-semibold transition-colors disabled:opacity-50 ${
              d === '✓'
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : d === '⌫'
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                : 'bg-gray-50 text-gray-900 hover:bg-gray-100'
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      <button
        onClick={() => router.back()}
        className="mt-6 text-sm text-gray-400 hover:text-gray-600"
      >
        ← Cambiar empleado
      </button>
    </div>
  );
}
