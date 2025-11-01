export interface MatchEvent {
  matchId: string;
  player1: string;
  player2: string;
}

export interface MatchUpdate {
  matchId: string;
  winner?: string;
}