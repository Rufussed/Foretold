import type { WizardGameState } from "../models/wizardGame.js";
import { currentPlayer } from "./personality.js";
import { strength } from "./handStrength.js";

// What a bot does with a Seer or a Trickster it has just won with: the new
// prediction, and whose it is (null for the Seer, the bot's own).
export interface PowerChoice {
  target: string | null;
  prediction: number;
}

// The Apprentice's Seer: nudge its own prediction one step towards what can
// still come true, and leave it alone while it can. It never works out odds; the
// Adept's reasoning is in powerReasoning.ts.
export function seerChoice(game: WizardGameState): PowerChoice {
  const player = currentPlayer(game);
  const prediction = player.prediction ?? 0;
  const tricksLeft = player.hand.length;

  let choice = prediction;
  if (prediction < player.tricksWon) choice = prediction + 1;
  else if (prediction > player.tricksWon + tricksLeft) choice = prediction - 1;

  return { target: null, prediction: Math.max(0, Math.min(game.currentRound, choice)) };
}

// A bot's Thief: whose hand to rob, and which of its own cards to trade for one
// of theirs taken unseen.
export interface ThiefSwap {
  target: string;
  ownIndex: number;
  targetIndex: number;
}

type GamePlayer = WizardGameState["players"][number];

// The players a Thief can rob, or just the one a test shortcut has named.
export function thiefVictims(game: WizardGameState): GamePlayer[] {
  const me = currentPlayer(game);
  const victims = game.players.filter((other) => other !== me && other.hand.length > 0);
  const named = victims.find((other) => other.username === game.devThiefTarget);
  return named ? [named] : victims;
}

// The swap giving away the weakest or the strongest card in hand, for a blind
// pick from the victim's cards.
export function swapWith(game: WizardGameState, victim: GamePlayer, give: "weakest" | "strongest"): ThiefSwap {
  const me = currentPlayer(game);
  // Scanning for the lowest strength, or, with the sign flipped, the highest.
  const sign = give === "weakest" ? 1 : -1;
  let ownIndex = 0;
  me.hand.forEach((card, index) => {
    if (sign * (strength(card, game.trumpSuit) - strength(me.hand[ownIndex]!, game.trumpSuit)) < 0) ownIndex = index;
  });

  // Their cards are hidden from the thief, so which one it takes is a blind pick.
  return { target: victim.username, ownIndex, targetIndex: Math.floor(Math.random() * victim.hand.length) };
}

// How many more tricks a player means to win this round.
export const stillWanted = (player: GamePlayer): number => (player.prediction ?? 0) - player.tricksWon;

// The Apprentice's Thief, kept simple. Short of its prediction it gives away its
// weakest card and robs whoever predicted the most still to come, who is
// likely to hold strong cards; with enough tricks (or too many) it gives away
// its strongest card and robs whoever wants the fewest.
export function simpleThief(game: WizardGameState): ThiefSwap {
  const victims = thiefVictims(game);
  if (victims.length === 0) throw new Error("There is nobody to steal from");

  // Short of tricks it wants strong cards: the likeliest holder is whoever wants
  // the most. With enough it wants to lose tricks, so it hunts for whoever wants
  // the fewest. The tiny random term settles ties without a fixed favourite.
  const needsTricks = stillWanted(currentPlayer(game)) > 0;
  const rank = (player: GamePlayer) => (needsTricks ? 1 : -1) * stillWanted(player) + Math.random() * 0.01;
  const victim = victims.reduce((best, player) => (rank(player) > rank(best) ? player : best));

  return swapWith(game, victim, needsTricks ? "weakest" : "strongest");
}
