export interface Match {
  matchId: string;
  player1: string;
  player2: string;
  status: 'pending' | 'active' | 'completed';
  winner?: string;
}

export interface QueueResponse {
  status: 'queued' | 'matched';
  matchId?: string;
}

export interface LeaderboardEntry {
  user: string;
  wins: number;
}