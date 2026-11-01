/** Pure game rules, kept free of I/O so they are trivial to unit test. */

export const MATCH_DURATION_MS = 10 * 60 * 1000;
export const FORFEIT_GRACE_MS = 30 * 1000;

/**
 * How far from your rating we look for an opponent. It starts strict for fair
 * games and widens the longer you wait, so nobody waits forever.
 */
export function ratingWindow(waitedMs: number): number {
  return Math.min(100 + Math.floor(waitedMs / 5_000) * 50, 1_000);
}

/**
 * Random problem, but one neither player has had recently. Problems they've
 * never seen come first; once they've seen everything, pick from the half they
 * saw longest ago, so repeats are as far apart as possible.
 */
export function chooseProblemId(
  problemIds: string[],
  recentMatches: Array<{ problemId: string; startedAt: Date }>,
  random: () => number = Math.random,
): string {
  const lastSeen = new Map<string, number>();
  for (const m of recentMatches) {
    lastSeen.set(m.problemId, Math.max(lastSeen.get(m.problemId) ?? 0, m.startedAt.getTime()));
  }
  const unseen = problemIds.filter((id) => !lastSeen.has(id));
  const pool = unseen.length
    ? unseen
    : [...problemIds]
        .sort((a, b) => lastSeen.get(a)! - lastSeen.get(b)!)
        .slice(0, Math.ceil(problemIds.length / 2));
  return pool[Math.floor(random() * pool.length)];
}

interface Attempt {
  userId: string;
  passed: number;
  createdAt: Date;
}

/**
 * Time ran out with no full solution. The player who passed more tests wins;
 * on a tie, whoever reached that score first wins; nothing passed is a draw.
 */
export function decideByProgress(attempts: Attempt[], playerIds: [string, string]): string | null {
  const best = playerIds.map((userId) => {
    let passed = 0;
    let at = Infinity;
    for (const a of attempts) {
      if (a.userId !== userId) continue;
      const time = a.createdAt.getTime();
      if (a.passed > passed || (a.passed === passed && passed > 0 && time < at)) {
        passed = a.passed;
        at = time;
      }
    }
    return { userId, passed, at };
  });

  const [a, b] = best;
  if (a.passed === 0 && b.passed === 0) return null;
  if (a.passed !== b.passed) return a.passed > b.passed ? a.userId : b.userId;
  if (a.at === b.at) return null;
  return a.at < b.at ? a.userId : b.userId;
}
