// app/match/[roomId]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { PROBLEM } from '@/lib/problem';
import React from 'react';

export default function MatchPage({ params }: { params: Promise<{ roomId: string }> }) {
  // THIS IS THE ONLY CORRECT WAY IN NEXT.JS 15+
  const { roomId } = React.use(params);

  const [code, setCode] = useState(PROBLEM);
  const [winner, setWinner] = useState<string | null>(null);
  const [myName, setMyName] = useState('Player');
  const [timeLeft, setTimeLeft] = useState(300);

  useEffect(() => {
    const name = localStorage.getItem('username') || 'Player';
    setMyName(name);
  }, []);

  // Poll for winner
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/match/${roomId}/winner`);
        const data = await res.json();
        if (data.winner) {
          setWinner(data.winner);
          clearInterval(interval);
        }
      } catch {}
    }, 1000);
    return () => clearInterval(interval);
  }, [roomId]);

  // Timer
  useEffect(() => {
    const t = setInterval(() => setTimeLeft(prev => prev > 0 ? prev - 1 : 0), 1000);
    return () => clearInterval(t);
  }, []);

  const submitCode = async () => {
    await fetch(`/api/match/${roomId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: myName, code }),
    });
  };

  if (winner) {
    const won = winner === myName;
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className={`text-9xl font-black ${won ? 'text-yellow-400' : 'text-red-600'}`}>
            {won ? 'VICTORY' : 'DEFEAT'}
          </h1>
          <p className="text-6xl mt-8">{won ? 'YOU WIN!' : `${winner} WINS!`}</p>
          <button
            onClick={() => window.location.href = '/dashboard'}
            className="mt-16 px-24 py-12 text-5xl bg-red-700 hover:bg-red-800 rounded-3xl font-bold"
          >
            RETURN TO ARENA
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      <div className="w-96 bg-black p-8 flex flex-col">
        <h1 className="text-5xl font-bold text-red-600 mb-8">CODE FIGHTER Z</h1>
        <p className="text-2xl mb-8">You: <span className="text-yellow-400 font-bold">{myName}</span></p>
        <p className="text-6xl font-mono text-red-500 mb-12">
          {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:
          {String(timeLeft % 60).padStart(2, '0')}
        </p>
        <div className="flex-1 bg-gray-800 rounded-xl p-6 overflow-auto text-sm">
          <pre>{`BINARY SEARCH DUEL

Fastest correct submission wins!

Return index of target or -1`}</pre>
        </div>
        <button
          onClick={submitCode}
          className="mt-8 py-6 text-4xl font-black bg-green-600 hover:bg-green-500 rounded-xl"
        >
          SUBMIT
        </button>
      </div>

      <div className="flex-1">
        <Editor
          height="100vh"
          defaultLanguage="javascript"
          value={code}
          onChange={(v) => setCode(v || '')}
          theme="vs-dark"
          options={{
            fontSize: 18,
            minimap: { enabled: false },
            wordWrap: 'on',
          }}
        />
      </div>
    </div>
  );
}