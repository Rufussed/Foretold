import * as THREE from "three";
import type { Card } from "../../../../backend/src/game/wizard/models/card";
import type { PlayedCard } from "../../../../backend/src/game/wizard/models/wizardGame";
import { unhurried } from "../../../visualizer/pace";
import type { Placement } from "../../../visualizer/placement";

// A Roles game's swaps in the trick: a Thief's 1 taking a card, a Servant's 2
// receiving the next one, a Fisher fishing. The server only swaps who owns the
// two cards; on the table each card sits in the place of the player who now
// owns it, so the two trade places, rising, crossing over each other and
// dropping into their new places (visualizer/table-cards.ts runs it). It
// never runs faster than at the default pace, so it can be followed at any
// game speed.

export const TRICK_SWAP = {
  // The pause after the card just played has landed, before the swap starts.
  pauseSeconds: 0.15,
  // Up out of the trick, across, and down into the new place.
  riseSeconds: 0.25,
  travelSeconds: 0.55,
  dropSeconds: 0.25,
  // How high each card rises, in card lengths: one higher than the other, so
  // they pass over each other rather than through.
  highLengths: 1.0,
  lowLengths: 0.45,
};

// The trick's cards in the order of the places they are shown in: each in the
// place of the player who played that turn's card, holding the card that
// player owns now. Outside a swap that is simply the order they were played.
export function cardsByOwner(playedCards: readonly PlayedCard[]): Card[] {
  return playedCards.map((turn) => {
    const player = turn.playedBy ?? turn.username;
    return (playedCards.find((played) => played.username === player) ?? turn).card;
  });
}

// The whole move's length, never faster than the default pace.
export const swapSeconds = (): number =>
  unhurried(TRICK_SWAP.riseSeconds) + unhurried(TRICK_SWAP.travelSeconds) + unhurried(TRICK_SWAP.dropSeconds);

const smooth = (t: number) => t * t * (3 - 2 * t);

// Where a swapped card is `t` seconds into its move from `from` to `to`; null
// once it has arrived. `high` picks the higher of the two paths; `up` is the
// table's up and `length` a card's length, both in the table's own units.
export function swapPlacement(
  from: Placement,
  to: Placement,
  t: number,
  high: boolean,
  up: THREE.Vector3,
  length: number,
): Placement | null {
  const rise = Math.max(unhurried(TRICK_SWAP.riseSeconds), 1e-6);
  const travel = Math.max(unhurried(TRICK_SWAP.travelSeconds), 1e-6);
  const drop = Math.max(unhurried(TRICK_SWAP.dropSeconds), 1e-6);
  const height = (high ? TRICK_SWAP.highLengths : TRICK_SWAP.lowLengths) * length * from.scale.z;
  const fromAbove = from.position.clone().addScaledVector(up, height);
  const toAbove = to.position.clone().addScaledVector(up, height);

  const place = (position: THREE.Vector3, k: number): Placement => ({
    position,
    quaternion: from.quaternion.clone().slerp(to.quaternion, k),
    scale: from.scale.clone().lerp(to.scale, k),
  });

  if (t < rise) return place(from.position.clone().lerp(fromAbove, smooth(t / rise)), 0);
  if (t < rise + travel) {
    const k = smooth((t - rise) / travel);
    return place(fromAbove.clone().lerp(toAbove, k), k);
  }
  if (t < rise + travel + drop) return place(toAbove.clone().lerp(to.position, smooth((t - rise - travel) / drop)), 1);
  return null;
}
