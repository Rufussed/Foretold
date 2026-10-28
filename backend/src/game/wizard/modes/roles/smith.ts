import type { Suit } from "../../models/card.js";
import type { PlayedCard } from "../../models/wizardGame.js";
import { powerOn, type RoleOf } from "./rolePlay.js";

// How many pieces of armour a Smith can wear, and what each block bounces
// back from the attacker; never more than the attacker has.
export const MAX_ARMOR = 3;
export const BLOCK_POINTS = 5;

export interface ArmorHolder {
  username: string;
  armor?: number;
}

// The Smith's power, a must: their 6 played in the lead suit or as a trump
// forges a piece of armour. It stays from round to round until used.
export const forgesArmor = (playedCards: PlayedCard[], trumpSuit: Suit | null, roleOf: RoleOf): boolean =>
  powerOn(playedCards, playedCards.length - 1, "smith", trumpSuit, roleOf);

// One more piece for the Smith, unless they wear all they can.
export function forge(smith: ArmorHolder): boolean {
  if ((smith.armor ?? 0) >= MAX_ARMOR) {
    return false;
  }

  smith.armor = (smith.armor ?? 0) + 1;

  return true;
}

// The armour at work, on its own: each piece blocks one power used against
// the Smith - a steal, a service or a catch of their card, or one seed or one
// sheep they would pay for - and is used up. Returns how many of `count`
// attacks were blocked.
export function block(smith: ArmorHolder | undefined, count = 1): number {
  const blocked = Math.min(count, smith?.armor ?? 0);

  if (smith && blocked) {
    smith.armor = (smith.armor ?? 0) - blocked;
  }

  return blocked;
}
