'use client';

import { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { PROBLEM } from '@/lib/problem';
import React from 'react';

export default function MatchPage({ params }: { params: Promise<{ roomId: string }> }) {
  // Safe unwrap of async route params via React.use()
  const unwrappedParams = React.use(params);
  const roomId = unwrappedParams?.roomId || '';

  const router = useRouter();

  const [code, setCode] = useState(PROBLEM);
  const [winner, setWinner] = useState<string | null>(null);
  const [myName, setMyName] = useState('Player');
  const [opponentName, setOpponentName] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(300);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const socketRef = useRef<Socket | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Clean-up helper function to dismantle timers instantly
  const cleanUpIntervals = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  // Extract room identities and parse opponent names securely
  useEffect(() => {
    if (!roomId) return;

    const name = localStorage.getItem('username') || 'Player';
    setMyName(name);

    const segments = roomId.split('_');
    if (segments.length >= 4) {
      const p1 = segments[2];
      const p2 = segments[3];
      const opponent = p1 === name ? p2 : p1;
      setOpponentName(opponent || 'Opponent');
    }
  }, [roomId]); // Strict array size 1

  // Establish real-time persistent websocket channels and event observers
  useEffect(() => {
    if (!roomId) return;

    const user = localStorage.getItem('username') || 'Player';
    
    const socket: Socket = io('http://localhost:3000', {
      query: { username: user },
      transports: ['websocket']
    });

    socketRef.current = socket;
    socket.emit('join_match_room', roomId);

    // Watch for automated forfeit termination decisions from the server
    socket.on('match_terminated_by_forfeit', (data: { winner: string; reason: string }) => {
      alert(data.reason);
      setWinner(data.winner);
      cleanUpIntervals();
    });

    socket.on('player_disconnected', (data: { username: string }) => {
      console.warn(`Opponent ${data.username} lost network connection. Countdown penalty window active.`);
    });

    socket.on('player_reconnected', (data: { username: string }) => {
      console.log(`Opponent ${data.username} successfully re-entered the arena workspace.`);
    });

    return () => {
      socket.disconnect();
    };
  }, [roomId]); // Strict array size 1

  // Standard match fallback status polling fallback with explicit cancellation
  useEffect(() => {
    if (!roomId) return;

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/match/${roomId}/winner`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.winner) {
          setWinner(data.winner);
          cleanUpIntervals();
        }
      } catch (err) {
        console.error('Failed checking server match state:', err);
      }
    }, 2000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [roomId]); // Strict array size 1

  // Synchronized server-side match timer authority tracking loop
  useEffect(() => {
    if (!roomId) return;

    const syncMatchTimer = async () => {
      try {
        const res = await fetch(`/api/match/${roomId}/time`);
        if (res.ok) {
          const data = await res.json();
          setTimeLeft(data.timeLeft);

          if (data.timeLeft <= 0) {
            cleanUpIntervals();
            return;
          }

          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

          // Start local interval countdown ticking loop only after syncing with the server clock
          timerIntervalRef.current = setInterval(() => {
            setTimeLeft((prev) => {
              if (prev <= 1) {
                cleanUpIntervals();
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        }
      } catch (err) {
        console.error('Failed syncing clock boundaries against backend server authority:', err);
      }
    };

    syncMatchTimer();

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [roomId]); // Strict array size 1

  const submitCode = async () => {
    if (isSubmitting || winner || !roomId) return;
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/match/${roomId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: myName, 
          opponent: opponentName || undefined,
          code 
        }),
      });
      
      const data = await res.json();
      if (!data.success && data.message) {
        alert(data.message);
      }
    } catch (err) {
      alert('Network transmission error during execution evaluation pipeline.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (winner) {
    const won = winner === myName;
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className={`text-9xl font-black tracking-wider transition-all duration-500 ${won ? 'text-yellow-400' : 'text-red-600'}`}>
            {won ? 'VICTORY' : 'DEFEAT'}
          </h1>
          <p className="text-5xl mt-8 font-semibold tracking-tight">
            {won ? 'YOU CONQUERED THE ARENA!' : `${winner} ACCEPTS GLORY!`}
          </p>
          <button
            onClick={async () => {
              cleanUpIntervals();
              try {
                await fetch('/api/match/cleanup', { method: 'POST' });
              } catch (err) {
                console.error('Failed to notify server of room departure:', err);
              }
              router.push('/dashboard');
              router.refresh();
            }}
            className="mt-16 px-24 py-12 text-4xl bg-gradient-to-r from-red-700 to-red-900 hover:from-red-600 hover:to-red-800 rounded-3xl font-black shadow-xl transition-all duration-200"
          >
            RETURN TO ARENA
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-zinc-950 text-white select-none">
      {/* Sidebar Controls */}
      <div className="w-96 bg-black p-8 flex flex-col border-r border-zinc-900">
        <h1 className="text-4xl font-black text-red-600 tracking-tighter mb-8">CODE FIGHTER Z</h1>
        
        <div className="space-y-2 mb-8 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/60">
          <p className="text-lg text-zinc-400">You: <span className="text-yellow-400 font-bold">{myName}</span></p>
          <p className="text-lg text-zinc-400">Versus: <span className="text-red-500 font-bold">{opponentName || 'Loading...'}</span></p>
        </div>

        <p className="text-6xl font-mono text-center font-bold tracking-tight text-red-500 bg-red-950/20 py-4 rounded-xl border border-red-900/30 mb-8">
          {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:
          {String(timeLeft % 60).padStart(2, '0')}
        </p>

        <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl p-6 overflow-auto text-sm font-mono leading-relaxed">
          <p className="text-red-500 font-bold border-b border-zinc-800 pb-2 mb-4">TASK PROMPT</p>
          <pre className="whitespace-pre-wrap text-zinc-300">{`BINARY SEARCH DUEL

Fastest correct submission wins!

Find and return the array index of target item, or return -1 if the search key cannot be located.`}</pre>
        </div>
        
        <button
          onClick={submitCode}
          disabled={isSubmitting || timeLeft === 0}
          className="mt-8 py-6 text-3xl font-black bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-500 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all"
        >
          {isSubmitting ? 'EVALUATING...' : 'SUBMIT CODE'}
        </button>
      </div>

      {/* Code Editor Space */}
      <div className="flex-1 h-full">
        <Editor
          height="100%"
          defaultLanguage="javascript"
          theme="vs-dark"
          value={code}
          onChange={(val) => setCode(val || '')}
          options={{
            fontSize: 16,
            minimap: { enabled: false },
            padding: { top: 20 },
            scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 }
          }}
        />
      </div>
    </div>
  );
}
