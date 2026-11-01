import { SUITS, type CardValue, type Suit } from "../../models/card.js";
import type { WizardGameState } from "../../models/wizardGame.js";
import { normalizeGameOptions } from "../../gameOptions.js";
import { roleCard } from "./roles.js";

// Test shortcut for a Roles game, answered only when the backend runs with
// WIZARD_DEV_TOOLS set (npm run play, or npm run dev:tools in backend/). Its errors start with
// "[dev]" so the table shows why one was refused.
//
//   { type: "dev_role_card", trump, cardIndex? }
export interface RolesDevMessage {
  type?: string;
  trump?: boolean;
  cardIndex?: number;
}

const devToolsOn = (game: WizardGameState): boolean =>
  !!process.env.WIZARD_DEV_TOOLS && normalizeGameOptions(game.options).mode === "roles";

// Puts this player's role card into their hand, in place of the card at
// `index`: in trumps, or in a plain suit (the replaced card's, unless that is
// trumps). In a round with no trumps both give a plain suit. Cards stay
// unique: if someone else holds that card, the two cards trade places.
export function devGiveRoleCard(game: WizardGameState, username: string, trump: boolean, index = 0): void {
  const me = game.players.find((player) => player.username === username);
  const replaced = me?.hand[index];
  const value = me?.role ? roleCard(me.role) : null;

  if (!me || !replaced) {
    throw new Error("[dev] You have no card there");
  }
  if (value === null) {
    throw new Error("[dev] Your role has no card of its own");
  }

  const plain: Suit = replaced.suit !== game.trumpSuit
    ? replaced.suit
    : SUITS.find((suit) => suit !== game.trumpSuit) ?? replaced.suit;
  const suit = trump && game.trumpSuit ? game.trumpSuit : plain;
  const holder = game.players.find((player) =>
    player.hand.some((held) => held.suit === suit && held.value === value),
  );

  if (holder) {
    const at = holder.hand.findIndex((held) => held.suit === suit && held.value === value);
    holder.hand[at] = replaced;
  }

  me.hand[index] = { suit, value: value as CardValue };
}

// The socket message, at any time, whoever's move it is, leaving the move's
// clock alone. True when it was this one and the card was given.
export function handleRolesDevCard(game: WizardGameState, username: string, message: RolesDevMessage): boolean {
  if (message.type !== "dev_role_card" || !devToolsOn(game)) return false;

  devGiveRoleCard(game, username, message.trump === true, typeof message.cardIndex === "number" ? message.cardIndex : 0);
  return true;
}
