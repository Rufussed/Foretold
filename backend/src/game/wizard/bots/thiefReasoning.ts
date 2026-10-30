import type { WizardGameState } from "../models/wizardGame.js";
import { currentPlayer } from "./personality.js";
import { ownWins } from "./powerReasoning.js";
import { stillWanted, swapWith, thiefVictims, type ThiefSwap } from "./powers.js";

// How the Adept uses a Thief it has just won with.
//
// It first asks whether its own hand will deliver its prediction: the tricks it
// expects from the cards it holds, against the tricks it still wants. Well short,
// it needs strength, so it gives away its weakest card and robs a player who
// wants many more tricks and so is likely to be holding strong cards (taking
// one also hurts them). Well over, it needs to lose tricks, so it gives away its
// strongest card to a player who already has enough, which pushes them over
// too. A round's leader is worth more to rob in either case. If the hand is
// about right, a swap is a gamble with nothing to win, and the Thief is left
// unused.

// How many tricks out either way before the hand needs fixing.
const SHORT_BY = 0.5;

// Extra weight for the round's leader, in tricks wanted.
const LEADER_WEIGHT = 1.5;

export function expectedThief(game: WizardGameState): ThiefSwap | null {
  const me = currentPlayer(game);
  const victims = thiefVictims(game);
  if (victims.length === 0) return null;

  // The tricks it expects to win from the cards it holds, as the mean of the
  // distribution of its future wins, against the tricks it still wants. Negative
  // is short of its prediction, positive is over it.
  const expected = ownWins(game).reduce((total, probability, wins) => total + probability * wins, 0);
  const gap = expected - stillWanted(me);
  // A test shortcut that names who to rob is always carried out.
  if (Math.abs(gap) < SHORT_BY && !game.devThiefTarget) return null;

  const needsTricks = gap < 0;
  // The best score among those it could rob, to pick out the round's leader.
  const leaderScore = Math.max(...victims.map((player) => player.score));
  const worth = (player: (typeof victims)[number]) => {
    const wanted = stillWanted(player);
    const leader = player.score === leaderScore && player.score >= me.score ? LEADER_WEIGHT : 0;
    // Short: whoever wants the most. Over: whoever already has what they want
    // is pushed over by a strong card.
    return (needsTricks ? wanted : wanted <= 0 ? 2 - wanted * 0.1 : -wanted) + leader + Math.random() * 0.01;
  };
  const victim = victims.reduce((best, player) => (worth(player) > worth(best) ? player : best));

  return swapWith(game, victim, needsTricks ? "weakest" : "strongest");
}
