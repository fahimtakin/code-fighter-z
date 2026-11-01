import { problems } from './catalog';
import type { Problem, PublicProblem } from './types';

export type { Difficulty, Problem, PublicProblem, TestCase } from './types';

const byId = new Map(problems.map((p) => [p.id, p]));

export function getProblem(id: string): Problem {
  const problem = byId.get(id);
  if (!problem) throw new Error(`Unknown problem: ${id}`);
  return problem;
}

export function starterCode(problem: Problem): string {
  return `function ${problem.functionName}(${problem.params.join(', ')}) {\n  // Your solution here\n}\n`;
}

/** Strips hidden tests: this is the only shape of a problem the browser ever sees. */
export function toPublicProblem(problem: Problem): PublicProblem {
  const { hiddenTests, ...rest } = problem;
  return { ...rest, starterCode: starterCode(problem), hiddenTestCount: hiddenTests.length };
}

export { problems };
