'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface LeaderboardEntry {
  user: string;
  wins: number;
}

export default function Dashboard() {
  const [username, setUsername] = useState('');
  const [status, setStatus] = useState<'idle' | 'searching'>('idle');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const pollInterval = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();

  // Load profile identity contexts and sync historical leader grids
  useEffect(() => {
    const user = localStorage.getItem('username');
    if (user) setUsername(user);

    fetchLeaderboard();

    // Pull user out of matching pool queues on initial mount to clear old state traces
    fetch('/api/queue', { method: 'DELETE' }).catch(console.error);

    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
    };
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch('/api/leaderboard');
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data);
      }
    } catch (err) {
      console.error('Failed retrieving global leaderboard datasets:', err);
    }
  };

  const joinQueue = async () => {
    if (status === 'searching') return;
    setStatus('searching');

    if (pollInterval.current) clearInterval(pollInterval.current);

    const poll = async () => {
      try {
        const res = await fetch('/api/queue', { method: 'POST' });
        
        if (res.status === 401) {
          router.push('/auth');
          return;
        }

        const data = await res.json();

        if (data.status === 'matched' && data.roomId) {
          if (pollInterval.current) clearInterval(pollInterval.current);
          router.push(`/match/${data.roomId}`);
        }
      } catch (err) {
        console.error('Matchmaking submission transaction failure:', err);
      }
    };

    await poll();
    pollInterval.current = setInterval(poll, 1000);
  };

  const leaveQueue = async () => {
    if (pollInterval.current) clearInterval(pollInterval.current);
    await fetch('/api/queue', { method: 'DELETE' });
    setStatus('idle');
  };

  const handleSignout = async () => {
    if (pollInterval.current) clearInterval(pollInterval.current);
    try {
      await fetch('/api/auth/signout', { method: 'POST' });
      localStorage.clear();
      router.push('/auth');
      router.refresh();
    } catch (err) {
      console.error('Failed processing signout transaction loop:', err);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-between p-8 select-none relative">
      {/* Absolute Utility Sign Out Position anchor */}
      <button 
        onClick={handleSignout}
        className="absolute top-8 right-8 px-5 py-2.5 text-sm font-bold bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 rounded-xl transition-all"
      >
        Sign Out
      </button>

      {/* Main Interactive Arena Frame Column */}
      <div className="flex-1 flex flex-col items-center justify-center my-12 text-center">
        <h1 className="text-8xl font-black mb-4 text-red-600 tracking-tighter">
          CODE FIGHTER Z
        </h1>

        <p className="text-3xl mb-12 text-zinc-400">
          Welcome, <span className="text-yellow-400 font-black">{username || 'Warrior'}</span>
        </p>

        {status === 'idle' ? (
          <button
            onClick={joinQueue}
            className="px-24 py-12 text-5xl font-black bg-gradient-to-r from-red-600 to-red-800 
                     hover:from-red-500 hover:to-red-700 rounded-3xl shadow-2xl 
                     transform hover:scale-102 transition duration-200 
                     border-4 border-red-900 tracking-tight"
          >
            ENTER ARENA
          </button>
        ) : (
          <div className="space-y-8 bg-zinc-950 p-12 rounded-3xl border border-zinc-900 max-w-md">
            <p className="text-3xl font-bold animate-pulse text-red-500 tracking-tight">ENGAGING MATCHMAKING POOL...</p>
            
            <div className="flex justify-center gap-4 py-2">
              <div className="w-4 h-4 bg-red-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-4 h-4 bg-red-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-4 h-4 bg-red-600 rounded-full animate-bounce"></div>
            </div>

            <button
              onClick={leaveQueue}
              className="px-8 py-3 text-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white rounded-xl font-bold transition-colors"
            >
              Cancel Search
            </button>
          </div>
        )}
      </div>

      {/* Global Leaderboard Standings Grid Layout Wrapper */}
      <div className="w-full max-w-xl bg-zinc-950 border border-zinc-900 rounded-2xl p-6 shadow-xl mb-4">
        <h2 className="text-xl font-black text-zinc-300 uppercase tracking-wider mb-4 border-b border-zinc-900 pb-3">
          Arena Leaderboard Standings
        </h2>
        {leaderboard.length === 0 ? (
          <p className="text-sm text-zinc-600 font-mono py-4 text-center">No historical logs recorded in current database index.</p>
        ) : (
          <div className="divide-y divide-zinc-900 max-h-48 overflow-y-auto pr-2 font-mono">
            {leaderboard.map((entry, index) => (
              <div key={entry.user} className="flex items-center justify-between py-3 text-sm">
                <div className="flex items-center gap-3">
                  <span className={`font-bold w-6 ${index === 0 ? 'text-yellow-400' : index === 1 ? 'text-zinc-400' : index === 2 ? 'text-amber-600' : 'text-zinc-600'}`}>
                    #{index + 1}
                  </span>
                  <span className={entry.user === username ? 'text-yellow-400 font-bold' : 'text-zinc-300'}>
                    {entry.user}
                  </span>
                </div>
                <span className="text-zinc-400 font-bold">{entry.wins} wins</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
