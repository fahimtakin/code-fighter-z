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
