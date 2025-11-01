'use client';
import { useState } from 'react';

export default function Dashboard() {
  const [status, setStatus] = useState('');

  const joinQueue = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/queue', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setStatus(data.status);
    if (data.matchId) {
      window.location.href = `/match/${data.matchId}`;
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Code Fighter Z</h1>
      <button onClick={joinQueue}>Join Queue</button>
      <p>{status}</p>
    </div>
  );
}