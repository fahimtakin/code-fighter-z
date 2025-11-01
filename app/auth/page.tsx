'use client';
import { useState } from 'react';
import { AuthRequest, AuthResponse } from '@/types/auth';

export default function AuthPage() {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [action, setAction] = useState<'signup' | 'login'>('login');
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async () => {
    setLoading(true);
    console.log('Submitting:', { action, username, password }); // Debug log

    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, username, password } as AuthRequest),
    });

    const data: AuthResponse = await res.json();
    console.log('API Response:', data); // Debug log

    if (data.token) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('username', username);
      console.log('Redirecting to /dashboard'); // Debug log
      window.location.href = '/dashboard'; // Full reload to trigger middleware
    } else {
      alert(data.error || 'Login failed');
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '400px', margin: '2rem auto', fontFamily: 'sans-serif' }}>
      <h1>{action === 'signup' ? 'Create Account' : 'Log In'}</h1>
      <input
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        style={{ width: '100%', padding: '0.5rem', margin: '0.5rem 0' }}
        disabled={loading}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ width: '100%', padding: '0.5rem', margin: '0.5rem 0' }}
        disabled={loading}
      />
      <div style={{ margin: '1rem 0' }}>
        <button onClick={() => setAction('login')} disabled={action === 'login' || loading} style={btnStyle}>
          Login
        </button>
        <button onClick={() => setAction('signup')} disabled={action === 'signup' || loading} style={btnStyle}>
          Signup
        </button>
      </div>
      <button onClick={handleSubmit} disabled={loading} style={{ ...btnStyle, width: '100%' }}>
        {loading ? 'Loading...' : action === 'signup' ? 'Create Account' : 'Log In'}
      </button>
    </div>
  );
}

const btnStyle = {
  padding: '0.5rem 1rem',
  margin: '0.25rem',
  background: '#0070f3',
  color: 'white',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
};