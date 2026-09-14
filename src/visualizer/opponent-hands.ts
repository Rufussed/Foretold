import type { CardFactory, CardObject } from "./card-objects";
import { blankCardTexture } from "./card-textures";
import type { SeatId } from "./player-characters";
import { applyPlacement } from "./placement";
import type { TableLayout } from "./table-layout";

export interface OpponentHands {
  // How many cards each other player holds, from game state.
  setCounts(counts: ReadonlyMap<SeatId, number>): void;
  // While dealing, show only this many of a seat's cards; null shows them all.
  setShown(seat: SeatId, shown: number | null): void;
  // How many of a seat's cards are showing right now.
  visibleCount(seat: SeatId): number;
  // Development aid.
  debug(): Array<{ seat: SeatId; count: number; visible: number }>;
}

interface Hand {
  cards: CardObject[];
  count: number;
  shown: number | null;
}

// The other players' hands: face-down cards on their copy of the card set,
// which faces them, so from your seat you see the backs.
export function createOpponentHands(factory: CardFactory, layout: TableLayout): OpponentHands {
  const hands = new Map<SeatId, Hand>();

  const handOf = (seat: SeatId): Hand => {
    let hand = hands.get(seat);
    if (!hand) {
      hand = { cards: [], count: 0, shown: null };
      hands.set(seat, hand);
    }
    return hand;
  };

  const refresh = (seat: SeatId) => {
    const hand = handOf(seat);
    const slots = layout.handFor(seat);
    const visible = Math.min(hand.count, hand.shown ?? hand.count, slots.length);
    while (hand.cards.length < visible) {
      const index = hand.cards.length;
      const card = factory.build(`opponent-seat${seat}-card${index + 1}`, blankCardTexture());
      applyPlacement(card.object, slots[index]);
      hand.cards.push(card);
    }
    hand.cards.forEach((card, index) => {
      card.object.visible = index < visible;
    });
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
