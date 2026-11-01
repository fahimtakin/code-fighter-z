import { describe, expect, it } from 'vitest';
import { judge, type JudgeCase } from '@/lib/judge';
import { getProblem, problems, type Problem } from '@/lib/problems';
import { referenceSolutions } from './fixtures/solutions';

const allCases = (p: Problem): JudgeCase[] => [
  ...p.examples.map((t) => ({ ...t, hidden: false })),
  ...p.hiddenTests.map((t) => ({ ...t, hidden: true })),
];

describe('problem catalog', () => {
  it('has a reference solution for every problem', () => {
    expect(Object.keys(referenceSolutions).sort()).toEqual(problems.map((p) => p.id).sort());
  });

  it.each(problems.map((p) => [p.id, p] as const))('%s: reference solution passes every test', async (_, problem) => {
    const result = await judge(referenceSolutions[problem.id], problem, allCases(problem));
    expect(result.cases.filter((c) => !c.passed)).toEqual([]);
    expect(result.verdict).toBe('accepted');
  });
});

describe('judge verdicts', () => {
  const twoSum = getProblem('two-sum');
  const climb = getProblem('climbing-stairs');
  const cases = allCases(twoSum);

  it('reports wrong answers with visible details but hides hidden inputs', async () => {
    const result = await judge('function twoSum() { return [0, 1]; }', twoSum, cases);
    expect(result.verdict).toBe('wrong_answer');
    expect(result.passed).toBeGreaterThan(0);
    expect(result.passed).toBeLessThan(result.total);
    const hiddenFailure = result.cases.find((c) => c.hidden && !c.passed)!;
    expect(hiddenFailure.input).toBeUndefined();
    expect(hiddenFailure.expected).toBeUndefined();
  });

  it('is strict about types: a string "4" is not the number 4', async () => {
    const search = getProblem('binary-search');
    const result = await judge('function search() { return "4"; }', search, [{ ...search.examples[0], hidden: false }]);
    expect(result.verdict).toBe('wrong_answer');
  });

  it('reports syntax errors as compile errors', async () => {
    const result = await judge('function twoSum( {', twoSum, cases);
    expect(result.verdict).toBe('compile_error');
    expect(result.passed).toBe(0);
  });

  it('requires the expected function name', async () => {
    const result = await judge('function solve() {}', twoSum, cases);
    expect(result.verdict).toBe('compile_error');
    expect(result.message).toContain('twoSum');
  });

  it('stops infinite loops with a time limit', async () => {
    const result = await judge('function twoSum() { while (true) {} }', twoSum, cases);
    expect(result.verdict).toBe('time_limit');
  });

  it('times out exponential solutions on the big hidden test', async () => {
    const naive = 'function climbStairs(n) { return n <= 2 ? n : climbStairs(n - 1) + climbStairs(n - 2); }';
    const result = await judge(naive, climb, allCases(climb));
    expect(result.verdict).toBe('time_limit');
  });

  it('reports thrown errors as runtime errors', async () => {
    const result = await judge('function twoSum() { throw new Error("boom"); }', twoSum, cases);
    expect(result.verdict).toBe('runtime_error');
    expect(result.cases[0].error).toContain('boom');
  });

  it('has no access to Node.js internals', async () => {
    const result = await judge(
      'function twoSum() { return [typeof require, typeof process, typeof fetch, typeof globalThis.setTimeout]; }',
      twoSum,
      [{ args: [[1, 2], 3], expected: ['undefined', 'undefined', 'undefined', 'undefined'], hidden: false }],
    );
    expect(result.verdict).toBe('accepted');
  });

  it('survives code that overwrites JSON', async () => {
    const result = await judge('JSON.stringify = () => "[0,1]"; function twoSum() { return [9, 9]; }', twoSum, cases);
    expect(result.verdict).toBe('wrong_answer');
  });

  it('enforces the memory limit', async () => {
    const result = await judge(
      'function twoSum() { const a = []; while (true) a.push(new Array(1e5).fill(1)); }',
      twoSum,
      cases,
    );
    expect(['runtime_error', 'time_limit']).toContain(result.verdict);
    expect(result.passed).toBe(0);
  });
});
