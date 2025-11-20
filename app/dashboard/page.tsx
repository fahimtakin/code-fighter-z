'use client';

import { useState, useEffect, useRef } from 'react';

export default function Dashboard() {
  const [username, setUsername] = useState('');
  const [status, setStatus] = useState<'idle' | 'searching'>('idle');
  const pollInterval = useRef<NodeJS.Timeout | null>(null);

  // LOAD USERNAME + AUTO-CLEAN OLD QUEUE/ROOM ON EVERY PAGE LOAD
  useEffect(() => {
    const user = localStorage.getItem('username');
    if (user) setUsername(user);

    // THIS LINE IS PURE MAGIC — removes ghost players forever
    fetch('/api/queue', { method: 'DELETE' }).catch(() => {});
  }, []);

  const joinQueue = async () => {
    if (status === 'searching') return;

    console.log('JOINING THE ARENA...');
    setStatus('searching');

    // Clear any old polling
    if (pollInterval.current) clearInterval(pollInterval.current);

    const poll = async () => {
      try {
        const res = await fetch('/api/queue', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
          },
        });

        const data = await res.json();
        console.log('Queue →', data);

        if (data.status === 'matched' && data.roomId) {
          console.log('MATCH FOUND!', data.roomId);
          if (pollInterval.current) clearInterval(pollInterval.current);
          window.location.href = `/match/${data.roomId}`;
        }
      } catch (err) {
        console.error('Poll failed:', err);
      }
    };

    // First poll immediately
    await poll();

    // Then every 350ms (fast but gentle)
    pollInterval.current = setInterval(poll, 350);
  };

  const leaveQueue = async () => {
    if (pollInterval.current) clearInterval(pollInterval.current);
    await fetch('/api/queue', { method: 'DELETE' });
    setStatus('idle');
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-8">
      <div className="text-center">
        {/* TITLE */}
        <h1 className="text-9xl font-bold mb-8 text-red-600 tracking-tighter">
          CODE FIGHTER Z
        </h1>

        {/* WELCOME */}
        <p className="text-5xl mb-16">
          Welcome, <span className="text-yellow-400 font-bold">{username || 'Warrior'}</span>
        </p>

        {/* IDLE → ENTER ARENA */}
        {status === 'idle' && (
          <button
            onClick={joinQueue}
            className="px-32 py-16 text-7xl font-black bg-gradient-to-r from-red-600 to-red-800 
                     hover:from-red-500 hover:to-red-700 rounded-3xl shadow-2xl 
                     transform hover:scale-105 transition duration-200 
                     border-8 border-red-900"
          >
            ENTER ARENA
          </button>
        )}

        {/* SEARCHING */}
        {status === 'searching' && (
          <div className="space-y-12">
            <p className="text-7xl font-bold animate-pulse">SEARCHING FOR OPPONENT...</p>
            
            <div className="flex justify-center gap-8">
              <div className="w-12 h-12 bg-red-600 rounded-full animate-bounce"></div>
              <div className="w-12 h-12 bg-red-600 rounded-full animate-bounce delay-100"></div>
              <div className="w-12 h-12 bg-red-600 rounded-full animate-bounce delay-200"></div>
            </div>

            <button
              onClick={leaveQueue}
              className="px-16 py-6 text-3xl bg-gray-800 hover:bg-gray-700 rounded-xl font-bold"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}