import type { Card } from "../../../models/card.js";
import type { WizardGameState } from "../../../models/wizardGame.js";
import { normalizeGameOptions } from "../../../gameOptions.js";
import { currentPlayer } from "../../../bots/personality.js";
import { powerOf } from "../cardPowers.js";
import { expectedSeerChoice, expectedTricksterChoice } from "./powerReasoning.js";
import { seerChoice, simpleThief, type PowerChoice, type ThiefSwap } from "./powers.js";
import { expectedThief } from "./sabotageThiefReasoning.js";

// How bots play Sabotage's card powers, by level. The Apprentice only mends
// its own prediction with a Seer, never uses a Trickster and robs by a simple
// rule (powers.ts); the Adept works out expected scores (powerReasoning.ts)
// and may leave a Thief unused (sabotageThiefReasoning.ts).

const isAdept = (game: WizardGameState): boolean => currentPlayer(game).botPersonality === "adept";

// What to do with the Seer or Trickster just won with.
export function chooseSabotagePower(game: WizardGameState): PowerChoice {
  const seer = game.currentTrick.sabotagePower?.kind === "seer";

  if (isAdept(game)) {
    return seer ? expectedSeerChoice(game) : expectedTricksterChoice(game);
  }

  return seer ? seerChoice(game) : { target: null, prediction: currentPlayer(game).prediction ?? 0 };
}

// What to do with the Thief just won with: a swap, or null to leave it unused.
export function chooseSabotageThief(game: WizardGameState): ThiefSwap | null {
  return isAdept(game) ? expectedThief(game) : simpleThief(game);
}

type Play = { card: Card; index: number };

// The Adept's card in a Sabotage game, when a power changes its choice:
// playing last with tricks still wanted, a winner that carries a power is free
// value (the Trickster knocks back a rival, the Seer can still mend its own
// bid); with enough tricks and only winners in hand, a Seer takes the trick
// and raises the bid to match (if the round allows a higher bid), and a
// Trickster at least makes use of it. Otherwise null: play as in Classic.
export function sabotagePick(
  game: WizardGameState,
  winners: Play[],
  losers: Play[],
  wantsTricks: boolean,
  weakest: (plays: Play[]) => Play,
): Play | null {
  // Leading is played as in Classic.
  if (normalizeGameOptions(game.options).mode !== "sabotage" || game.currentTrick.playedCards.length === 0) {
    return null;
  }

  const withPower = (kind: "seer" | "trickster") => winners.filter(({ card }) => powerOf(card) === kind);
  const playsLast = game.currentTrick.playedCards.length === game.players.length - 1;

  if (wantsTricks) {
    if (!playsLast || winners.length === 0) return null;
    const powered = [...withPower("trickster"), ...withPower("seer")];
    return powered.length > 0 ? weakest(powered) : null;
  }

  if (losers.length > 0 || winners.length === 0) return null;

  const seers = (currentPlayer(game).prediction ?? 0) + 1 <= game.currentRound ? withPower("seer") : [];
  if (seers.length > 0) return weakest(seers);
  const tricksters = withPower("trickster");
  return tricksters.length > 0 ? weakest(tricksters) : null;
}
