import Link from 'next/link';
import { Logo } from '@/components/logo';
import { getServerSession } from '@/lib/auth/server-session';

const steps = [
  { title: 'Get matched', body: 'Join the queue and get paired with someone near your rating in seconds.' },
  { title: 'Solve it first', body: 'Same problem, same clock. Run the examples, then submit against hidden tests.' },
  { title: 'Climb the ladder', body: 'Wins move your Elo rating. Beat stronger players to climb faster.' },
];

export default async function HomePage() {
  const session = await getServerSession();
  const cta = session ? { href: '/dashboard', label: 'Go to dashboard' } : { href: '/auth', label: 'Start fighting' };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <Link href={cta.href} className="text-sm font-semibold text-zinc-400 hover:text-white">
          {session ? session.username : 'Sign in'}
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 py-16">
        <p className="mb-4 font-mono text-sm uppercase tracking-[0.2em] text-red-500">Real-time 1v1 coding duels</p>
        <h1 className="max-w-3xl text-5xl font-black leading-[1.05] tracking-tight sm:text-7xl">
          Two coders. One problem. <span className="text-red-600">First to solve wins.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-zinc-400">
          LeetCode-style problems judged in a secure sandbox, live opponent progress, and an Elo ladder that rewards
          beating people better than you.
        </p>
        <div className="mt-10">
          <Link
            href={cta.href}
            className="inline-block rounded-xl bg-red-600 px-8 py-4 text-lg font-bold text-white shadow-lg shadow-red-950/40 transition hover:bg-red-500"
          >
            {cta.label}
          </Link>
        </div>

        <div className="mt-20 grid gap-4 sm:grid-cols-3">
          {steps.map((step, i) => (
            <div key={step.title} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
              <p className="font-mono text-sm text-red-500">0{i + 1}</p>
              <h2 className="mt-2 text-lg font-bold">{step.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{step.body}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
