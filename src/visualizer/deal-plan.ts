import { SUITS, type Card } from "../../backend/src/game/wizard/models/card";
import type { SeatId } from "./player-characters";

export type Recipient = { kind: "local" } | { kind: "seat"; seat: SeatId };

export interface PlannedCard {
  // Who receives the card, or "trump" for the card turned up after the deal.
  to: Recipient | "trump";
  // Which of the recipient's card slots it lands in, counting from 0.
  slot: number;
  card: Card;
}

export interface DealPlanInput {
  // Everyone dealt to, in dealing order: starting on the dealer's left.
  recipients: readonly Recipient[];
  cardsEach: number;
  // Your cards in the order they fill your slots; null deals you random ones.
  localHand: readonly Card[] | null;
  // Other players' cards, where you can see them (a blind round); anyone not
  // listed is dealt random ones.
  seatHands?: ReadonlyMap<SeatId, readonly Card[]>;
  // The trump card; "draw" turns up a random one; null for none.
  trump: Card | null | "draw";
  random?: () => number;
}

const fullDeck = (): Card[] =>
  SUITS.flatMap((suit) =>
    Array.from({ length: 15 }, (_, value) => ({ suit, value: value as Card["value"] })),
  );

const sameCard = (a: Card, b: Card) => a.suit === b.suit && a.value === b.value;

// The order cards leave the stack, top first: one at a time round the
// recipients, cardsEach times over, then the trump. Cards this player will see
// (their own hand or, in a blind round, the others', and the trump) are placed
// where they'll be dealt; everything else in the stack is shuffled, as in a
// real deck.
export function planDeal({
  recipients,
  cardsEach,
  localHand,
  seatHands,
  trump,
  random = Math.random,
}: DealPlanInput): PlannedCard[] {
  const known = [
    ...(localHand ?? []),
    ...[...(seatHands?.values() ?? [])].flat(),
    ...(trump && trump !== "draw" ? [trump] : []),
  ];
  const deck = fullDeck().filter((card) => !known.some((other) => sameCard(other, card)));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  const plan: PlannedCard[] = [];
  for (let slot = 0; slot < cardsEach; slot++) {
    for (const to of recipients) {
      const seen = to.kind === "local" ? localHand : seatHands?.get(to.seat);
      const card = seen ? seen[slot] : deck.pop();
      if (!card) return plan;
      plan.push({ to, slot, card });
    }
  }

  const trumpCard = trump === "draw" ? deck.pop() : trump;
  if (trumpCard) plan.push({ to: "trump", slot: 0, card: trumpCard });
  return plan;
}
