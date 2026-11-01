'use client';

import { useRouter } from 'next/navigation';
import { api } from '@/lib/client/api';

export function SignOutButton() {
  const router = useRouter();
  async function signOut() {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    router.replace('/auth');
    router.refresh();
  }
  return (
    <button
      onClick={signOut}
      className="rounded-lg border border-zinc-800 px-3 py-1.5 text-sm text-zinc-400 transition hover:border-zinc-700 hover:text-white"
    >
      Sign out
    </button>
  );
}
