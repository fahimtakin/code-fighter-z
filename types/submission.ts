export interface CodeSubmission {
  matchId: string;
  code: string;
  username: string;
}

export interface SubmissionResult {
  passed: boolean;
  time: number;
  output: string;
}

export interface SubmissionResponse {
  status: 'submitted' | 'completed';
  winner?: string;
}