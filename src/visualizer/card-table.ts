import type * as THREE from "three";
import type { Card, Suit } from "../../backend/src/game/wizard/models/card";
import { createCardControls } from "./card-controls";
import { createCardDeal, type CardDeal, type DealStep } from "./card-deal";
import { createCardFactory } from "./card-objects";
import { cardKey, cardTexture, trumpFaceTexture } from "./card-textures";
import { planDeal, type PlannedCard, type Recipient } from "./deal-plan";
import { isLocalTurn, localPlayer, type GameConnection } from "./game-connection";
import { createOpponentHands, type OpponentHands } from "./opponent-hands";
import type { SeatId } from "./player-characters";
import { createTableCards, type TableCards } from "./table-cards";
import type { TableLayout } from "./table-layout";
import type { SceneView } from "./three-scene";

export interface CardTableOptions {
  environment: THREE.Object3D;
  view: SceneView;
  layout: TableLayout;
  // Null for the demo table: rounds are dealt at random and plays stay local.
  game: GameConnection | null;
  // The seat a player sits in, or null if they have none.
  seatOf(username: string): SeatId | null;
}

export interface CardTable {
  readonly cards: TableCards;
  readonly deal: CardDeal;
  readonly opponents: OpponentHands;
  // Call after every game-state update.
  applyState(): void;
  // The server refused an action; a card waiting to be played returns.
  refused(): void;
  // Demo table: gather the cards and deal a fresh random round.
  redealDemo(): void;
  update(deltaSeconds: number): void;
  dispose(): void;
}

const DEMO_CARDS_EACH = 9;

// Everything cards: connects the stack and dealing, your hand and its pointer
// controls, the other players' hands, the trick and the trump to the game.
// A new round is dealt from the stack; a card dropped on the play area is sent
// to the server as your play.
export function createCardTable({
  environment,
  view,
  layout,
  game,
  seatOf,
}: CardTableOptions): CardTable {
  const factory = createCardFactory(environment);
  const cards = createTableCards(environment, factory, layout);
  const opponents = createOpponentHands(factory, layout);
  const deal = createCardDeal(factory, layout);

  // Only on your turn while cards are being played; the server has the final
  // say either way. Always allowed on the demo table.
  const canPlay = () => !game || (game.state()?.phase === "playing" && isLocalTurn(game));

  const onPlay = (key: string) => {
    if (!game) {
      cards.confirmPlay();
      return;
    }
    // The server identifies a card by its index in the hand it dealt, not by
    // the order you've arranged your cards in.
    const cardIndex = localPlayer(game)?.hand.findIndex((card) => cardKey(card) === key) ?? -1;
    if (cardIndex === -1 || !game.send({ type: "play_card", cardIndex })) {
      cards.cancelPlay();
    }
  };

  const controls = createCardControls({
    canvas: view.canvas,
    camera: view.camera,
    cards,
    holdOrbit: view.holdOrbit,
    canPlay,
    onPlay,
  });

  // Runs a planned deal: hides whatever is about to arrive, then reveals each
  // card as it lands.
  const runDeal = (plan: readonly PlannedCard[], trumpSuit: Suit | null) => {
    deal.reset();

    const localKeys = plan.flatMap((planned) =>
      planned.to !== "trump" && planned.to.kind === "local" ? [cardKey(planned.card)] : [],
    );
    cards.holdForDeal(localKeys);
    cards.holdTrump(plan.some((planned) => planned.to === "trump"));

    const shown = new Map<SeatId, number>();
    for (const planned of plan) {
      if (planned.to !== "trump" && planned.to.kind === "seat") shown.set(planned.to.seat, 0);
    }
    for (const seat of shown.keys()) opponents.setShown(seat, 0);

    const steps = plan.flatMap((planned): DealStep[] => {
      const { to, card, slot } = planned;
      if (to === "trump") {
        return layout.trump
          ? [{ target: layout.trump, face: trumpFaceTexture(card, trumpSuit), onLanded: () => cards.holdTrump(false) }]
          : [];
      }
      if (to.kind === "local") {
        const target = layout.localHand[slot];
        const key = cardKey(card);
        return target ? [{ target, face: cardTexture(card), onLanded: () => cards.releaseDealt(key) }] : [];
      }
      const seat = to.seat;
      const target = layout.handFor(seat)[slot];
      return target
        ? [{
            target,
            face: null,
            onLanded: () => {
              const count = (shown.get(seat) ?? 0) + 1;
              shown.set(seat, count);
              opponents.setShown(seat, count);
            },
          }]
        : [];
    });

    deal.deal(steps, () => {
      for (const seat of shown.keys()) opponents.setShown(seat, null);
      cards.holdForDeal([]);
      cards.holdTrump(false);
    });
  };

  let dealtRound: number | null = null;

  const applyState = () => {
    const state = game?.state();
    if (!game || !state) return;

    const hand = localPlayer(game)?.hand ?? [];
    cards.setHand(hand);
    cards.setTrick(state.currentTrick.playedCards.map((played) => played.card));
    cards.setTrump(state.trumpCard, state.trumpSuit);

    const counts = new Map<SeatId, number>();
    for (const player of state.players) {
      if (player.username === game.localUsername) continue;
      const seat = seatOf(player.username);
      if (seat !== null) counts.set(seat, player.handCount);
    }
    opponents.setCounts(counts);

    if (state.currentRound === dealtRound) return;
    // Opening the table partway through a round shows it as it stands.
    const joinedPartway =
      dealtRound === null &&
      (state.players.some((player) => player.prediction !== null) ||
        state.currentTrick.playedCards.length > 0);
    dealtRound = state.currentRound;

    const playerCount = state.players.length;
    if (joinedPartway) {
      deal.settle(state.currentRound * playerCount + (state.trumpCard ? 1 : 0));
      return;
    }

    // The round starts with the player on the dealer's left, and so does the
    // deal; it then goes round in turn order, which is clockwise at the table.
    const recipients: Recipient[] = [];
    for (let i = 0; i < playerCount; i++) {
      const player = state.players[(state.startingPlayerIndex + i) % playerCount];
      if (player.username === game.localUsername) {
        recipients.push({ kind: "local" });
      } else {
        const seat = seatOf(player.username);
        if (seat !== null) recipients.push({ kind: "seat", seat });
      }
    }

    const byKey = new Map(hand.map((card) => [cardKey(card), card]));
    const localHand = cards
      .handOrder()
      .map((key) => byKey.get(key))
      .filter((card): card is Card => !!card);

    runDeal(
      planDeal({ recipients, cardsEach: state.currentRound, localHand, trump: state.trumpCard }),
      state.trumpSuit,
    );
  };

  // On the demo table you deal: the first card goes to your left, and the deal
  // goes clockwise round every seat, ending with you.
  const redealDemo = () => {
    const recipients: Recipient[] = [
      ...layout.clockwiseSeats.map((seat) => ({ kind: "seat" as const, seat })),
      { kind: "local" },
    ];
    const plan = planDeal({ recipients, cardsEach: DEMO_CARDS_EACH, localHand: null, trump: "draw" });
    const localCards = plan.flatMap((planned) =>
      planned.to !== "trump" && planned.to.kind === "local" ? [planned.card] : [],
    );
    const trumpCard = plan.find((planned) => planned.to === "trump")?.card ?? null;
    // A Jester means no trump; a turned-up Wizard's suit would be chosen by the
    // dealer, which the demo doesn't do.
    const trumpSuit = trumpCard && trumpCard.value !== 0 && trumpCard.value !== 14 ? trumpCard.suit : null;

    cards.cancelPlay();
    cards.setTrick([]);
    cards.setHand([]);
    cards.setHand(localCards);
    cards.setTrump(trumpCard, trumpSuit);
    opponents.setCounts(new Map(layout.clockwiseSeats.map((seat) => [seat, DEMO_CARDS_EACH])));
    runDeal(plan, trumpSuit);
  };

  const onDealKey = (event: KeyboardEvent) => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key.toLowerCase() === "d") redealDemo();
  };

  if (!game) {
    redealDemo();
    if (import.meta.env.DEV) window.addEventListener("keydown", onDealKey);
  }

  return {
    cards,
    deal,
    opponents,
    applyState,
    refused: () => cards.cancelPlay(),
    redealDemo,
    update(deltaSeconds) {
      deal.update(deltaSeconds);
      cards.update(deltaSeconds);
    },
    dispose() {
      controls.dispose();
      window.removeEventListener("keydown", onDealKey);
    },
  };
}
