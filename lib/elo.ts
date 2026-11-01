/**
 * Elo rating (the chess system). Beating a stronger player earns more points than
 * beating a weaker one, and the two players' changes always sum to zero.
 */
export const DEFAULT_RATING = 1200;
export const K_FACTOR = 32;

/** Probability that a player rated `rating` beats one rated `opponentRating`. */
export function expectedScore(rating: number, opponentRating: number): number {
  return 1 / (1 + 10 ** ((opponentRating - rating) / 400));
}

/**
 * @param score result from player A's point of view: 1 = win, 0.5 = draw, 0 = loss
 * @returns rating changes for [A, B]
 */
export function ratingDeltas(ratingA: number, ratingB: number, score: 0 | 0.5 | 1): [number, number] {
  const delta = Math.round(K_FACTOR * (score - expectedScore(ratingA, ratingB)));
  return [delta, 0 - delta]; // not -delta: that yields -0 for a draw between equals
}
