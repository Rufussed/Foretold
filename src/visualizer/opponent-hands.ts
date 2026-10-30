import * as THREE from "three";
import type { CardFactory, CardObject } from "./card-objects";
import { blankCardTexture } from "./card-textures";
import type { SeatId } from "./player-characters";
import { applyPlacement, type Placement } from "./placement";
import { THIEF } from "./config";
import { centredSlots, type TableLayout } from "./table-layout";

export interface OpponentHands {
  // How many cards each other player holds, from game state.
  setCounts(counts: ReadonlyMap<SeatId, number>): void;
  // While dealing, show only this many of a seat's cards; null shows them all.
  setShown(seat: SeatId, shown: number | null): void;
  // How many of a seat's cards are showing right now.
  visibleCount(seat: SeatId): number;
  // Brings a seat's fan to the slots this gives for its card count, easing there
  // over `seconds`; null sends it back home the same way. Cards keep their
  // order, so card i stays card i.
  present(seat: SeatId, slots: ((count: number) => readonly Placement[]) | null, seconds?: number): void;
  // Hides or shows one card of a fan, which stays counted: a card that has
  // flown away leaves its place empty until the one that replaces it lands.
  setHidden(seat: SeatId, index: number, hidden: boolean): void;
  // Moves any fan that is on its way. Call every frame.
  update(deltaSeconds: number): void;
  // The card at this position in a seat's fan, if it is showing.
  cardObject(seat: SeatId, index: number): CardObject | null;
  // Where that card is right now, in environment space.
  placementOf(seat: SeatId, index: number): Placement | null;
  // Where that card sits in the fan at rest, with the fan at home.
  homePlacement(seat: SeatId, index: number): Placement | null;
  // Development aid.
  debug(): Array<{ seat: SeatId; count: number; visible: number }>;
}

interface Hand {
  cards: CardObject[];
  count: number;
  shown: number | null;
  // Where the fan is being brought to, how far it has got (0 home, 1 there)
  // and which way it is going.
  presented: ((count: number) => readonly Placement[]) | null;
  amount: number;
  goal: number;
  seconds: number;
  hidden: Set<number>;
}

const ease = (t: number) => t * t * (3 - 2 * t);

// The other players' hands: face-down cards on their copy of the card set,
// which faces them, so from your seat you see the backs.
export function createOpponentHands(factory: CardFactory, layout: TableLayout, up: THREE.Vector3): OpponentHands {
  const hands = new Map<SeatId, Hand>();

  const handOf = (seat: SeatId): Hand => {
    let hand = hands.get(seat);
    if (!hand) {
      hand = { cards: [], count: 0, shown: null, presented: null, amount: 0, goal: 0, seconds: 1, hidden: new Set() };
      hands.set(seat, hand);
    }
    return hand;
  };

  const refresh = (seat: SeatId) => {
    const hand = handOf(seat);
    // Centred for the cards they hold, so dealt cards land where they stay and
    // the fan re-centres as cards are played.
    const slots = centredSlots(layout.handFor(seat), hand.count);
    const visible = Math.min(hand.shown ?? hand.count, slots.length);
    while (hand.cards.length < visible) {
      const index = hand.cards.length;
      hand.cards.push(factory.build(`opponent-seat${seat}-card${index + 1}`, blankCardTexture()));
    }
    hand.cards.forEach((card, index) => {
      card.object.visible = index < visible && !hand.hidden.has(index);
      if (index < visible) applyPlacement(card.object, placed(hand, slots, index));
    });
  };

  // A card's place, between its slot at home and its slot in the presented fan.
  const placed = (hand: Hand, slots: readonly Placement[], index: number): Placement => {
    const home = slots[index];
    const there = hand.amount > 0 ? hand.presented?.(hand.count)[index] : undefined;
    if (!there) return home;
    // Coming forward the fan rises, only to the height it will have
    // in front of you, and then moves across and forward. Going home it moves
    // across at that height until it is over its place, and then drops.
    // Each card rises and drops along its own long axis, pointing up from the
    // table, not straight up: the fan's cards are all turned a little off the
    // vertical, and this keeps each from cutting through the table or its neighbour.
    const height = Math.max(there.position.clone().sub(home.position).dot(up), 0);
    const along = new THREE.Vector3(0, 0, 1).applyQuaternion(home.quaternion);
    if (along.dot(up) < 0) along.negate();
    const apex = home.position.clone().addScaledVector(along, height / Math.max(along.dot(up), 0.25));
    const rise = THIEF.fanRiseShare;
    const position =
      hand.amount < rise
        ? home.position.clone().lerp(apex, ease(hand.amount / rise))
        : apex.lerp(there.position, ease((hand.amount - rise) / (1 - rise)));
    return {
      position,
      quaternion: home.quaternion.clone().slerp(there.quaternion, ease(hand.amount)),
      scale: home.scale.clone().lerp(there.scale, ease(hand.amount)),
    };
  };

  return {
    setCounts(counts) {
      for (const seat of new Set([...hands.keys(), ...counts.keys()])) {
        handOf(seat).count = counts.get(seat) ?? 0;
        refresh(seat);
      }
    },

    setShown(seat, shown) {
      handOf(seat).shown = shown;
      refresh(seat);
    },

    setHidden(seat, index, hidden) {
      const hand = handOf(seat);
      if (hidden) hand.hidden.add(index);
      else hand.hidden.delete(index);
      refresh(seat);
    },

    present(seat, slots, seconds = 1) {
      const hand = handOf(seat);
      if (slots) hand.presented = slots;
      hand.goal = slots ? 1 : 0;
      hand.seconds = Math.max(seconds, 0.01);
    },

    update(deltaSeconds) {
      for (const [seat, hand] of hands) {
        if (!hand.presented) continue;
        if (hand.amount !== hand.goal) {
          const step = deltaSeconds / hand.seconds;
          hand.amount = hand.goal > hand.amount ? Math.min(hand.goal, hand.amount + step) : Math.max(hand.goal, hand.amount - step);
        }
        // A fan that has come home lets go of its target.
        if (hand.amount === 0 && hand.goal === 0) {
          hand.presented = null;
          refresh(seat);
          continue;
        }
        // The presented fan rides with the camera, so it is placed every frame.
        refresh(seat);
      }
    },

    cardObject(seat, index) {
      const card = hands.get(seat)?.cards[index];
      return card?.object.visible ? card : null;
    },

    placementOf(seat, index) {
      const hand = hands.get(seat);
      if (!hand) return null;
      const slots = centredSlots(layout.handFor(seat), hand.count);
      return index < slots.length ? placed(hand, slots, index) : null;
    },

    homePlacement(seat, index) {
      const hand = hands.get(seat);
      return hand ? centredSlots(layout.handFor(seat), hand.count)[index] ?? null : null;
    },

    visibleCount(seat) {
      return hands.get(seat)?.cards.filter((card) => card.object.visible).length ?? 0;
    },

    debug() {
      return [...hands.entries()].map(([seat, hand]) => ({
        seat,
        count: hand.count,
        visible: hand.cards.filter((card) => card.object.visible).length,
      }));
    },
  };
}
