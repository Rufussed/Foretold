import type { CardValue } from "../../models/card.js";
import { isBotName } from "../../models/bot.js";
import type { GamePlayer, WizardGameState } from "../../models/wizardGame.js";
import { SABOTAGE_THIEF_VALUE } from "./cardPowers.js";

// Test shortcuts for a Sabotage game, answered only when the backend runs with
// WIZARD_DEV_TOOLS set (websocket/wizardSocket.ts). Their errors start with
// "[dev]" so the table shows why one was refused.

// Puts the card of this value (a Thief, Trickster or Seer) in the trump suit
// into this player's hand, in place of the card at `index`. Cards stay unique:
// if someone else holds that card, the two cards trade places.
export function devGiveCard(game: WizardGameState, username: string, value: CardValue, index = 0): void {
  const me = game.players.find((player) => player.username === username);

  const replaced = me?.hand[index];

  if (!me || !replaced) {
    throw new Error("[dev] You have no card there");
  }

  // A Fool or Wizard keeps the suit of the card it replaces, which decides
  // whose art it shows; the powers take the trump suit.
  const suit = value === 0 || value === 14 ? replaced.suit : game.trumpSuit ?? replaced.suit;
  const holder = game.players.find((player) =>
    player.hand.some((held) => held.suit === suit && held.value === value),
  );

  if (holder) {
    const at = holder.hand.findIndex((held) => held.suit === suit && held.value === value);
    holder.hand[at] = replaced;
  }

  me.hand[index] = { suit, value };
}

// A bot leads a trump Thief, to watch one being used: robbing you ("me"), or
// another bot ("other", the bystander's view). It wins if nothing higher is
// played. Any cards already played in the trick go back to their players'
// hands first, so it works at any moment. playCard is the game service's.
export function devBotThief(
  game: WizardGameState,
  username: string,
  mode: "me" | "other",
  playCard: (game: WizardGameState, cardIndex: number) => void,
): void {
  if (game.phase !== "playing") {
    throw new Error("[dev] Only while cards are being played");
  }

  // What each hand will hold once the trick's cards are back.
  const holds = (player: GamePlayer) =>
    player.hand.length + game.currentTrick.playedCards.filter((played) => played.username === player.username).length;

  const thief = game.players.find((player) => isBotName(player.username) && holds(player) >= 2);
  const victim =
    mode === "me"
      ? game.players.find((player) => player.username === username)
      : game.players.find((player) => isBotName(player.username) && player !== thief && holds(player) > 0);

  if (!thief || !victim) {
    throw new Error(
      "[dev] Needs a bot holding two or more cards (round 2 or later)" +
        (mode === "other" ? ", and a second bot to rob" : ""),
    );
  }

  // Put the trick's cards back, so every hand is as it was before the trick.
  for (const played of game.currentTrick.playedCards) {
    game.players.find((player) => player.username === played.username)?.hand.push(played.card);
  }
  game.currentTrick = { playedCards: [], winnerUsername: null };

  devGiveCard(game, thief.username, SABOTAGE_THIEF_VALUE, 0);
  game.currentPlayerIndex = game.players.indexOf(thief);
  game.devThiefTarget = victim.username;
  playCard(game, 0);
}
