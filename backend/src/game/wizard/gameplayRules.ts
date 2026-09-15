import { GAMEPLAY_RULES } from "./gameplayRulesConfig.js";

interface PredictingPlayer {
  prediction: number | null;
}

// The prediction the player now choosing may not make, or null if any is
// allowed. Applies only to the round's last predictor, and only when the
// forbidden number is one they could otherwise choose (0 to tricksThisRound).
export function forbiddenPrediction(
  players: readonly PredictingPlayer[],
  tricksThisRound: number,
): number | null {
  if (!GAMEPLAY_RULES.lastPredictionCannotMatchTricks) return null;
  const waiting = players.filter((player) => player.prediction === null).length;
  if (waiting !== 1) return null;
  const predicted = players.reduce((total, player) => total + (player.prediction ?? 0), 0);
  const forbidden = tricksThisRound - predicted;
  return forbidden >= 0 && forbidden <= tricksThisRound ? forbidden : null;
}

// An NPC's choice moved off the forbidden number: one lower or one higher, by
// GAMEPLAY_RULES.npcForbiddenGoesLowerChance, staying within 0..tricksThisRound.
export function avoidForbiddenPrediction(
  choice: number,
  forbidden: number | null,
  tricksThisRound: number,
  random: () => number = Math.random,
): number {
  if (forbidden === null || choice !== forbidden) return choice;
  const lower = forbidden - 1 >= 0 ? forbidden - 1 : null;
  const higher = forbidden + 1 <= tricksThisRound ? forbidden + 1 : null;
  if (lower !== null && higher !== null) {
    return random() < GAMEPLAY_RULES.npcForbiddenGoesLowerChance ? lower : higher;
  }
  return lower ?? higher ?? choice;
}
