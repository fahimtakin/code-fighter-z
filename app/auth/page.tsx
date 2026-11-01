'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AuthPage() {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [action, setAction] = useState<'signup' | 'login'>('login');
  const [loading, setLoading] = useState<boolean>(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return alert('Please provide your credentials.');
    setLoading(true);

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, username, password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        localStorage.setItem('username', data.username);
        localStorage.setItem('token', data.token);
        router.push('/dashboard');
        router.refresh();
      } else {
        alert(data.error || 'Authentication processing error.');
      }
    } catch (err) {
      alert('Network failure connecting to auth systems.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-900 p-8 rounded-2xl shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-red-600 tracking-tighter mb-2">
            CODE FIGHTER Z
          </h1>
          <p className="text-sm text-zinc-400">
            {action === 'signup' ? 'Create an identity to join the arena' : 'Sign in to access your combat metrics'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">Username</label>
            <input
              type="text"
              placeholder="Enter username"
              value={username}
              onChange={(e) => setUsername(e.target.value.trim())}
              disabled={loading}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-red-600 transition-colors"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">Password</label>
            <input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-red-600 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-lg shadow-red-950/20 active:scale-98 disabled:opacity-50"
          >
            {loading ? 'Processing Transaction...' : action === 'signup' ? 'Create Account' : 'Authenticate Identity'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-zinc-900 text-center flex items-center justify-center gap-2">
          <span className="text-sm text-zinc-500">
            {action === 'signup' ? 'Already possess an account?' : 'New candidate to the ranks?'}
          </span>
          <button
            onClick={() => setAction(action === 'login' ? 'signup' : 'login')}
            className="text-sm text-red-500 hover:text-red-400 font-bold transition-colors underline bg-transparent border-none cursor-pointer"
          >
            {action === 'login' ? 'Sign Up' : 'Log In'}
          </button>
        </div>
      </div>
    </div>
  );
}
