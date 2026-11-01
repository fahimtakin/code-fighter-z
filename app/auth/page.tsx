'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Logo } from '@/components/logo';
import { api, ApiError } from '@/lib/client/api';

type Mode = 'login' | 'signup';
type FieldErrors = Partial<Record<'username' | 'password', string>>;

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors({});
    try {
      await api(`/api/auth/${mode}`, { method: 'POST', json: { username, password } });
      router.replace('/dashboard');
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        setFieldErrors({ username: err.fields.username?.[0], password: err.fields.password?.[0] });
      }
      setError(err instanceof ApiError ? err.message : 'Could not reach the server');
      setLoading(false);
    }
  }

  const switchMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    setError(null);
    setFieldErrors({});
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Logo />
          <h1 className="mt-6 text-2xl font-bold">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {mode === 'login' ? 'Sign in to jump into the queue.' : 'Everyone starts at 1200 rating.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6" noValidate>
          <Field
            label="Username"
            value={username}
            onChange={setUsername}
            autoComplete="username"
            error={fieldErrors.username}
            hint={mode === 'signup' ? '3–20 characters: letters, numbers, _ or -' : undefined}
          />
          <Field
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            error={fieldErrors.password}
            hint={mode === 'signup' ? 'At least 8 characters' : undefined}
          />

          {error && !fieldErrors.username && !fieldErrors.password && (
            <p role="alert" className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full rounded-xl bg-red-600 py-3 font-bold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-400">
          {mode === 'login' ? 'New here?' : 'Already have an account?'}{' '}
          <button onClick={switchMode} className="font-semibold text-red-500 hover:text-red-400">
            {mode === 'login' ? 'Create an account' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete: string;
  error?: string;
  hint?: string;
}) {
  const id = props.label.toLowerCase();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
        {props.label}
      </label>
      <input
        id={id}
        type={props.type ?? 'text'}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        autoComplete={props.autoComplete}
        aria-invalid={!!props.error}
        className={`w-full rounded-lg border bg-zinc-950 px-3 py-2.5 text-white outline-none transition placeholder:text-zinc-600 focus:border-red-600 ${
          props.error ? 'border-red-700' : 'border-zinc-800'
        }`}
      />
      {props.error ? (
        <p className="mt-1 text-xs text-red-400">{props.error}</p>
      ) : (
        props.hint && <p className="mt-1 text-xs text-zinc-500">{props.hint}</p>
      )}
    </div>
  );
}
