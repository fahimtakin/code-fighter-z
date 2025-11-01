'use client';
import { useEffect, useState } from 'react';

export default function MatchPage({ params }: { params: { matchId: string } }) {
  const [opponent, setOpponent] = useState('');
  const [problem, setProblem] = useState('');
  const [code, setCode] = useState('');

  useEffect(() => {
    // Fetch match data
    fetch(`/api/match/${params.matchId}`)
      .then(r => r.json())
      .then(data => {
        setOpponent(data.player2);
        setProblem('Binary Search: Find target in sorted array');
      });
  }, [params.matchId]);

  const submitCode = async () => {
    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ matchId: params.matchId, code }),
    });
    const result = await res.json();
    alert(result.win ? 'YOU WIN!' : 'Try again');
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Code Battle</h1>
      <p><strong>Opponent:</strong> {opponent}</p>
      <p><strong>Problem:</strong> {problem}</p>
      <textarea
        value={code}
        onChange={e => setCode(e.target.value)}
        placeholder="Write your Python code here..."
        style={{ width: '100%', height: '200px', fontFamily: 'monospace', padding: '1rem' }}
      />
      <button onClick={submitCode} style={{ padding: '1rem 2rem', background: '#dc3545', color: 'white', border: 'none', borderRadius: '8px', marginTop: '1rem' }}>
        Submit Code
      </button>
    </div>
  );
}