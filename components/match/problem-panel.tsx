import type { PublicProblem } from '@/lib/problems/types';

const difficultyStyle = {
  easy: 'bg-emerald-950 text-emerald-400',
  medium: 'bg-amber-950 text-amber-400',
  hard: 'bg-red-950 text-red-400',
};

/** Renders `backtick` spans as inline code without pulling in a markdown library. */
function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`]+`)/).map((part, i) =>
        part.startsWith('`') ? <code key={i}>{part.slice(1, -1)}</code> : <span key={i}>{part}</span>,
      )}
    </>
  );
}

export function ProblemPanel({ problem }: { problem: PublicProblem }) {
  return (
    <div className="prose-code space-y-6 p-6 text-sm leading-relaxed text-zinc-300">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-white">{problem.title}</h1>
          <span className={`rounded-md px-2 py-0.5 text-xs font-bold uppercase ${difficultyStyle[problem.difficulty]}`}>
            {problem.difficulty}
          </span>
        </div>
        <div className="mt-4 space-y-3">
          {problem.description.split('\n\n').map((para, i) => (
            <p key={i}>
              <RichText text={para} />
            </p>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {problem.examples.map((ex, i) => (
          <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 font-mono text-xs">
            <p className="mb-2 font-sans text-xs font-bold uppercase tracking-wider text-zinc-500">Example {i + 1}</p>
            <p className="break-all">
              <span className="text-zinc-500">Input: </span>
              {problem.params.map((name, j) => `${name} = ${JSON.stringify(ex.args[j])}`).join(', ')}
            </p>
            <p className="break-all">
              <span className="text-zinc-500">Output: </span>
              {JSON.stringify(ex.expected)}
            </p>
          </div>
        ))}
      </div>

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-500">Constraints</p>
        <ul className="list-inside list-disc space-y-1 font-mono text-xs">
          {problem.constraints.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-zinc-500">
        Submitting runs the {problem.examples.length} examples plus {problem.hiddenTestCount} hidden tests.
      </p>
    </div>
  );
}
