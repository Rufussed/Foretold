// How a round is scored. Shared by the score calculator and the round-result
// breakdown the frontend shows, so the two cannot drift apart.

// An exact prediction earns this, plus POINTS_PER_TRICK for each trick won.
export const EXACT_PREDICTION_BONUS = 2;
export const POINTS_PER_TRICK = 1;

// A miss loses this for each trick of difference.
export const MISS_PENALTY_PER_TRICK = 1;
