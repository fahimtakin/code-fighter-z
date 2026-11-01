export type Difficulty = 'easy' | 'medium' | 'hard';

export interface TestCase {
  args: unknown[];
  expected: unknown;
}

export interface Problem {
  id: string;
  title: string;
  difficulty: Difficulty;
  /** Paragraphs separated by blank lines; `backticks` render as inline code. */
  description: string;
  constraints: string[];
  functionName: string;
  params: string[];
  /** Shown to players and used by "Run". */
  examples: TestCase[];
  /** Never sent to the browser; only "Submit" runs them. */
  hiddenTests: TestCase[];
}

/** Everything about a problem that is safe to send to the browser. */
export type PublicProblem = Omit<Problem, 'hiddenTests'> & {
  starterCode: string;
  hiddenTestCount: number;
};
