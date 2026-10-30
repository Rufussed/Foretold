import type { Card } from "../../models/card.js";
import type { PlayedCard } from "../../models/wizardGame.js";
import { playerOf, type RoleOf } from "./rolePlay.js";
import { roleCard } from "./roles.js";

// What a holder pays the Shepherd per sheep, and how many sheep a Shepherd
// has to give out. Winning with a 5 is hard, so a sheep is worth twice a seed.
export const SHEEP_POINTS = 20;
export const FLOCK = 3;

// The sheep a player holds, by the Shepherd who gave them. They stay from
// round to round until that Shepherd is paid for them.
export type Sheep = Record<string, number>;

export interface SheepHolder {
  username: string;
  score: number;
  sheep?: Sheep;
}

export const sheepCount = (sheep: Sheep | undefined): number =>
  Object.values(sheep ?? {}).reduce((sum, count) => sum + count, 0);

// How many of this Shepherd's sheep are out with other players.
export const sheepOut = (players: SheepHolder[], shepherd: string): number =>
  players.reduce((sum, holder) => sum + (holder.sheep?.[shepherd] ?? 0), 0);

// The Shepherd's power, a must: each Shepherd's 5 gives a sheep to whoever
// wins the trick, wherever the 5 ended up. Like the Farmer's 4, the 5 does
// so in any suit.
export function laidBy(playedCards: PlayedCard[], roleOf: RoleOf): { shepherd: string; card: Card }[] {
  return playedCards.flatMap((played) =>
    played.card.value === roleCard("shepherd") && roleOf(playerOf(played)) === "shepherd"
      ? [{ shepherd: playerOf(played), card: played.card }]
      : []);
}

// The trick's winner takes one of the Shepherd's sheep, while the Shepherd
// has any left to give. A Shepherd never takes their own sheep.
export function giveSheep(players: SheepHolder[], winner: SheepHolder, shepherd: string): boolean {
  if (winner.username === shepherd || sheepOut(players, shepherd) >= FLOCK) {
    return false;
  }

  winner.sheep = { ...winner.sheep, [shepherd]: (winner.sheep?.[shepherd] ?? 0) + 1 };

  return true;
}

// The Shepherd won a trick with their own 5: everyone holding their sheep
// pays SHEEP_POINTS each, and the whole flock comes home. Never more than the
// holder has, so nothing from 0 or below. `shield` says how many of a
// holder's sheep their armour blocks (smith.ts); those bring nothing. Returns
// who pays how many points, and how many sheep were blocked; moving the
// points is the caller's.
export function collect<T extends SheepHolder>(
  players: T[],
  shepherd: string,
  shield: (holder: T, count: number) => number = () => 0,
): { holder: T; points: number; blocked: number }[] {
  return players.flatMap((holder) => {
    const count = holder.sheep?.[shepherd] ?? 0;

    if (!count || !holder.sheep) {
      return [];
    }

    delete holder.sheep[shepherd];
    const blocked = shield(holder, count);

    return [{ holder, points: Math.min((count - blocked) * SHEEP_POINTS, Math.max(0, holder.score)), blocked }];
  });
}
