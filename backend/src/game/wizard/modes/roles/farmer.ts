import type { Card } from "../../models/card.js";
import type { PlayedCard } from "../../models/wizardGame.js";
import { playerOf, type RoleOf } from "./rolePlay.js";
import { roleCard } from "./roles.js";

// What one seed is worth at harvest, and how many seeds a player can hold in
// all, of every Farmer together.
export const SEED_POINTS = 5;
export const MAX_SEEDS = 4;

// The seeds a player holds, by the Farmer who planted them. They stay from
// round to round until that Farmer harvests them.
export type Seeds = Record<string, number>;

export interface SeedHolder {
  username: string;
  score: number;
  seeds?: Seeds;
}

export const seedCount = (seeds: Seeds | undefined): number =>
  Object.values(seeds ?? {}).reduce((sum, count) => sum + count, 0);

// The Farmer's power, a must: each Farmer's 4 plants a seed for whoever wins
// the trick, wherever the 4 ended up. Unlike the other roles' cards, the 4
// plants in any suit: off the lead suit it only loses, which suits a seed.
export function plantedBy(playedCards: PlayedCard[], roleOf: RoleOf): { farmer: string; card: Card }[] {
  return playedCards.flatMap((played) =>
    played.card.value === roleCard("farmer") && roleOf(playerOf(played)) === "farmer"
      ? [{ farmer: playerOf(played), card: played.card }]
      : []);
}

// The trick's winner takes the Farmer's seed, unless they already hold as
// many as they can: then it is lost. A Farmer never takes their own seed.
export function plant(winner: SeedHolder, farmer: string): boolean {
  if (winner.username === farmer || seedCount(winner.seeds) >= MAX_SEEDS) {
    return false;
  }

  winner.seeds = { ...winner.seeds, [farmer]: (winner.seeds?.[farmer] ?? 0) + 1 };

  return true;
}

// The Farmer made their prediction exactly: once the round is scored, every
// seed of theirs is harvested at once, SEED_POINTS each, and its holder is
// left without. A Farmer who missed harvests nothing; the seeds wait. A Farmer farms good
// land only: never more than the holder has, so nothing from 0 or below.
// `shield` says how many of a holder's seeds their armour blocks (smith.ts);
// those bring nothing. Returns who gives how many points, and how many seeds
// were blocked; moving the points is the caller's.
export function harvest<T extends SeedHolder>(
  players: T[],
  farmer: string,
  shield: (holder: T, count: number) => number = () => 0,
): { holder: T; points: number; blocked: number }[] {
  return players.flatMap((holder) => {
    const count = holder.seeds?.[farmer] ?? 0;

    if (!count || !holder.seeds) {
      return [];
    }

    delete holder.seeds[farmer];
    const blocked = shield(holder, count);

    return [{ holder, points: Math.min((count - blocked) * SEED_POINTS, Math.max(0, holder.score)), blocked }];
  });
}
