import type { Card, CardValue, Suit } from "../../models/card.js";
import type { PlayedCard } from "../../models/wizardGame.js";
import type { RoleOf } from "./rolePlay.js";
import type { RoleId } from "./roles.js";

// Small builders for the roles' tests.

export const card = (value: CardValue, suit: Suit = "Red"): Card => ({ value, suit });

export const play = (username: string, value: CardValue, suit: Suit = "Red"): PlayedCard => ({
  username,
  playedBy: username,
  card: card(value, suit),
});

export const roles = (byName: Record<string, RoleId>): RoleOf => (username) => byName[username];
