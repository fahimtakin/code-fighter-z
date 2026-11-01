import { describe, expect, it } from 'vitest';
import { expectedScore, ratingDeltas } from '@/lib/elo';
import { chooseProblemId, decideByProgress, ratingWindow } from '@/lib/match/rules';

describe('elo', () => {
  it('gives even odds to equal ratings', () => {
    expect(expectedScore(1200, 1200)).toBe(0.5);
  });

  it('moves equal players by half the K-factor', () => {
    expect(ratingDeltas(1200, 1200, 1)).toEqual([16, -16]);
    expect(ratingDeltas(1200, 1200, 0)).toEqual([-16, 16]);
  });

  it('rewards upsets more than expected wins', () => {
    const [upset] = ratingDeltas(1000, 1400, 1);
    const [expected] = ratingDeltas(1400, 1000, 1);
    expect(upset).toBeGreaterThan(expected);
  });

  it('a draw between equals changes nothing; a draw against a stronger player gains points', () => {
    expect(ratingDeltas(1200, 1200, 0.5)).toEqual([0, 0]);
    expect(ratingDeltas(1000, 1400, 0.5)[0]).toBeGreaterThan(0);
  });

  it('is always zero-sum', () => {
    for (const [a, b] of [[1200, 1500], [1800, 900], [1337, 1338]]) {
      for (const score of [0, 0.5, 1] as const) {
        const [da, db] = ratingDeltas(a, b, score);
        expect(da + db).toBe(0);
      }
    }
  });
});

describe('ratingWindow', () => {
  it('starts narrow and widens with waiting time up to a cap', () => {
    expect(ratingWindow(0)).toBe(100);
    expect(ratingWindow(10_000)).toBe(200);
    expect(ratingWindow(10 * 60_000)).toBe(1_000);
  });
});

describe('decideByProgress (match timed out)', () => {
  const t = (s: number) => new Date(1_000_000 + s * 1000);
  const players: [string, string] = ['a', 'b'];

  it('is a draw when nobody submitted', () => {
    expect(decideByProgress([], players)).toBeNull();
  });

  it('is a draw when nobody passed anything', () => {
    expect(decideByProgress([{ userId: 'a', passed: 0, createdAt: t(1) }], players)).toBeNull();
  });

  it('picks whoever passed more tests', () => {
    const attempts = [
      { userId: 'a', passed: 5, createdAt: t(10) },
      { userId: 'b', passed: 7, createdAt: t(50) },
    ];
    expect(decideByProgress(attempts, players)).toBe('b');
  });

  it('breaks ties by who reached that score first', () => {
    const attempts = [
      { userId: 'a', passed: 6, createdAt: t(40) },
      { userId: 'b', passed: 6, createdAt: t(30) },
      { userId: 'b', passed: 6, createdAt: t(90) },
    ];
    expect(decideByProgress(attempts, players)).toBe('b');
  });

  it("uses each player's best attempt, not their last", () => {
    const attempts = [
      { userId: 'a', passed: 8, createdAt: t(10) },
      { userId: 'a', passed: 2, createdAt: t(20) },
      { userId: 'b', passed: 7, createdAt: t(15) },
    ];
    expect(decideByProgress(attempts, players)).toBe('a');
  });
});

describe('chooseProblemId', () => {
  const ids = ['a', 'b', 'c', 'd'];
  const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000);

  it('spreads picks across the whole bank for new players', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(chooseProblemId(ids, []));
    expect([...seen].sort()).toEqual(ids);
  });

  it('never repeats a problem while unseen ones remain', () => {
    const recent = [
      { problemId: 'a', startedAt: at(1) },
      { problemId: 'c', startedAt: at(5) },
    ];
    for (let i = 0; i < 100; i++) expect(['b', 'd']).toContain(chooseProblemId(ids, recent));
  });

  it('once everything was seen, picks from the least recently played half', () => {
    const recent = [
      { problemId: 'a', startedAt: at(1) },
      { problemId: 'b', startedAt: at(40) },
      { problemId: 'c', startedAt: at(2) },
      { problemId: 'd', startedAt: at(30) },
    ];
    for (let i = 0; i < 100; i++) expect(['b', 'd']).toContain(chooseProblemId(ids, recent));
  });

  it('uses the most recent time a problem was played', () => {
    const recent = [
      { problemId: 'a', startedAt: at(100) },
      { problemId: 'a', startedAt: at(1) },
      { problemId: 'b', startedAt: at(50) },
      { problemId: 'c', startedAt: at(60) },
      { problemId: 'd', startedAt: at(70) },
    ];
    for (let i = 0; i < 100; i++) expect(['c', 'd']).toContain(chooseProblemId(ids, recent));
  });
});
