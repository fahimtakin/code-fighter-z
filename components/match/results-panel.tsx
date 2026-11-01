import type { SubmitResponse, Verdict } from '@/lib/shared/types';

const verdicts: Record<Verdict, { label: string; color: string }> = {
  accepted: { label: 'Accepted', color: 'text-emerald-400' },
  wrong_answer: { label: 'Wrong Answer', color: 'text-red-400' },
  runtime_error: { label: 'Runtime Error', color: 'text-red-400' },
  time_limit: { label: 'Time Limit Exceeded', color: 'text-amber-400' },
  compile_error: { label: 'Compile Error', color: 'text-red-400' },
};

export function ResultsPanel({ response, error }: { response: SubmitResponse | null; error: string | null }) {
  if (error) {
    return <p className="p-4 text-sm text-red-400">{error}</p>;
  }
  if (!response) {
    return (
      <div className="p-4 text-sm text-zinc-500">
        <p>
          <span className="font-semibold text-zinc-300">Run</span> checks your code against the examples.{' '}
          <span className="font-semibold text-zinc-300">Submit</span> runs the hidden tests too, and a full pass wins
          the match.
        </p>
        <p className="mt-2 font-mono text-xs">Ctrl+Enter: run · Ctrl+Shift+Enter: submit</p>
      </div>
    );
  }

  const { result, mode } = response;
  const verdict = verdicts[result.verdict];
  const visible = result.cases.filter((c) => !c.hidden);
  const hidden = result.cases.filter((c) => c.hidden);

  return (
    <div className="space-y-3 p-4 text-sm">
      <div className="flex items-baseline gap-3">
        <span className={`text-lg font-bold ${verdict.color}`}>{verdict.label}</span>
        <span className="font-mono text-xs text-zinc-500">
          {result.passed}/{result.total} passed · {result.durationMs} ms · {mode === 'run' ? 'examples only' : 'all tests'}
        </span>
      </div>

      {result.message && (
        <pre className="whitespace-pre-wrap rounded-lg border border-red-900/50 bg-red-950/30 p-3 font-mono text-xs text-red-300">
          {result.message}
        </pre>
      )}

      {visible.map((c) => (
        <div
          key={c.index}
          className={`rounded-lg border p-3 font-mono text-xs ${c.passed ? 'border-emerald-900/50 bg-emerald-950/10' : 'border-red-900/50 bg-red-950/10'}`}
        >
          <p className={`mb-1 font-sans font-bold ${c.passed ? 'text-emerald-400' : 'text-red-400'}`}>
            {c.passed ? '✓' : '✗'} Example {c.index + 1}
          </p>
          <p className="break-all text-zinc-400">
            <span className="text-zinc-600">input </span>
            {c.input}
          </p>
          <p className="break-all text-zinc-400">
            <span className="text-zinc-600">expected </span>
            {c.expected}
          </p>
          {c.error ? (
            <p className="break-all text-red-400">
              <span className="text-zinc-600">error </span>
              {c.error}
            </p>
          ) : (
            <p className="break-all text-zinc-400">
              <span className="text-zinc-600">got </span>
              {c.actual}
            </p>
          )}
        </div>
      ))}

      {hidden.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {hidden.map((c) => (
            <span
              key={c.index}
              className={`rounded px-2 py-0.5 font-mono text-xs ${c.passed ? 'bg-emerald-950 text-emerald-400' : 'bg-red-950 text-red-400'}`}
            >
              hidden {c.index + 1} {c.passed ? '✓' : '✗'}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
