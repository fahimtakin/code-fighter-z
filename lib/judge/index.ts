import ivm from 'isolated-vm';
import type { Problem, TestCase } from '../problems';
import type { CaseResult, JudgeResult, Verdict } from '../shared/types';
import { Semaphore } from './semaphore';

export type { CaseResult, JudgeResult, Verdict };

/**
 * Runs untrusted player code inside a fresh V8 isolate per submission.
 * The isolate has no Node APIs (no require, process, fs or network), its own
 * memory cap, and a CPU timeout per test, so a malicious or broken solution can
 * only hurt itself.
 */

export const MEMORY_LIMIT_MB = 32;
export const CASE_TIMEOUT_MS = 1_000;
const LOAD_TIMEOUT_MS = 500;
const MAX_PREVIEW_CHARS = 300;

// Each isolate is a real V8 heap; cap how many exist at once so a burst of
// submissions queues up instead of exhausting server memory.
const judgeSlots = new Semaphore(4);

export interface JudgeCase extends TestCase {
  hidden: boolean;
}

// Loaded before user code. It captures JSON before the player could overwrite
// it, and `const` means the player can't replace the helper itself.
const HARNESS = `
const __cfzCall = (() => {
  const stringify = JSON.stringify;
  const parse = JSON.parse;
  return (fn, argsJson) => {
    const result = fn(...parse(argsJson));
    return result === undefined ? undefined : stringify(result);
  };
})();
`;

const preview = (value: string) =>
  value.length > MAX_PREVIEW_CHARS ? `${value.slice(0, MAX_PREVIEW_CHARS)}… (${value.length} chars)` : value;

function formatInput(problem: Problem, args: unknown[]): string {
  return preview(problem.params.map((name, i) => `${name} = ${JSON.stringify(args[i])}`).join(', '));
}

const isTimeout = (err: unknown) => err instanceof Error && /timed out/i.test(err.message);
const isMemoryLimit = (err: unknown) => err instanceof Error && /memory limit/i.test(err.message);
const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));

export function judge(code: string, problem: Problem, cases: JudgeCase[]): Promise<JudgeResult> {
  return judgeSlots.run(() => runIsolated(code, problem, cases));
}

async function runIsolated(code: string, problem: Problem, cases: JudgeCase[]): Promise<JudgeResult> {
  const started = performance.now();
  const total = cases.length;
  const finish = (verdict: Verdict, results: CaseResult[], message?: string): JudgeResult => ({
    verdict,
    passed: results.filter((r) => r.passed).length,
    total,
    cases: results,
    message,
    durationMs: Math.round(performance.now() - started),
  });

  const isolate = new ivm.Isolate({ memoryLimit: MEMORY_LIMIT_MB });
  try {
    const context = await isolate.createContext();
    await context.eval(HARNESS);

    // 1. Load the player's code. Syntax errors, top-level throws and top-level
    //    infinite loops all end here.
    try {
      const script = await isolate.compileScript(code, { filename: 'solution.js' });
      await script.run(context, { timeout: LOAD_TIMEOUT_MS });
    } catch (err) {
      if (isTimeout(err)) return finish('time_limit', [], 'Your code timed out while loading');
      return finish('compile_error', [], errorMessage(err));
    }

    const fnType = await context.eval(`typeof ${problem.functionName}`);
    if (fnType !== 'function') {
      return finish('compile_error', [], `Define a function named ${problem.functionName}(${problem.params.join(', ')})`);
    }

    // 2. Run each case. Arguments cross into the isolate as a JSON string and the
    //    result comes back as one, so no object references are ever shared.
    const results: CaseResult[] = [];
    let verdict: Verdict = 'accepted';
    let message: string | undefined;

    for (const [index, testCase] of cases.entries()) {
      const expected = JSON.stringify(testCase.expected);
      const call = `__cfzCall(${problem.functionName}, ${JSON.stringify(JSON.stringify(testCase.args))})`;
      const result: CaseResult = { index, hidden: testCase.hidden, passed: false };
      if (!testCase.hidden) {
        result.input = formatInput(problem, testCase.args);
        result.expected = preview(expected);
      }

      try {
        const output: string | undefined = await context.eval(call, { timeout: CASE_TIMEOUT_MS });
        // Comparing canonical JSON is strict on types: "4" is not 4, [4] is not 4.
        result.passed = output === expected;
        if (!testCase.hidden) result.actual = output === undefined ? 'undefined' : preview(output);
        if (!result.passed && verdict === 'accepted') verdict = 'wrong_answer';
      } catch (err) {
        const timedOut = isTimeout(err);
        const reason = timedOut
          ? `Time limit exceeded (${CASE_TIMEOUT_MS} ms)`
          : isMemoryLimit(err)
            ? `Memory limit exceeded (${MEMORY_LIMIT_MB} MB)`
            : errorMessage(err);
        if (!testCase.hidden) result.error = reason;
        if (verdict === 'accepted' || verdict === 'wrong_answer') {
          verdict = timedOut ? 'time_limit' : 'runtime_error';
          message = testCase.hidden ? `Hidden test ${index + 1}: ${reason}` : reason;
        }
        results.push(result);
        // Once an isolate has hit a limit, more runs are just wasted CPU (and a
        // memory overrun disposes it entirely). The remaining cases count as failed.
        if (timedOut || isMemoryLimit(err) || isolate.isDisposed) break;
        continue;
      }
      results.push(result);
    }

    return finish(verdict, results, message);
  } finally {
    if (!isolate.isDisposed) isolate.dispose();
  }
}
