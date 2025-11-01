'use client';
import { useState, useEffect } from 'react';

export default function Dashboard() {
  const [status, setStatus] = useState('');

  const checkQueue = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/queue', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
    });
    const data = await res.json();
    setStatus(data.status);

    if (data.matchId) {
      window.location.href = `/match/${data.matchId}`;
    }
  };

  useEffect(() => {
    if (status === 'waiting') {
      const interval = setInterval(checkQueue, 1500);
      return () => clearInterval(interval);
    }
  }, [status]);

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>Code Fighter Z</h1>
      <h2>Dashboard</h2>
      <button 
        onClick={checkQueue} 
        disabled={status === 'waiting'}
        style={{ 
          padding: '1rem 2rem', 
          fontSize: '1.2rem', 
          background: status === 'waiting' ? '#6c757d' : '#28a745', 
          color: 'white', 
          border: 'none', 
          borderRadius: '8px' 
        }}
      >
        {status === 'waiting' ? 'Waiting for opponent...' : 'Join Queue'}
      </button>
      <p>{status}</p>
    </div>
  );
}