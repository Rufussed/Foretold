import * as THREE from "three";
import { WizardRules } from "../../backend/src/game/wizard/services/wizardRules";
import type { Card, Suit } from "../../backend/src/game/wizard/models/card";
import { createCardControls } from "./card-controls";
import { createCardDeal, type CardDeal, type DealStep } from "./card-deal";
import { createCardFactory } from "./card-objects";
import { cardKey, cardTexture, trumpColor, trumpFaceTexture } from "./card-textures";
import { TRICK_REWARD } from "./config";
import { planDeal, type PlannedCard, type Recipient } from "./deal-plan";
import { isLocalTurn, localPlayer, type GameConnection } from "./game-connection";
import { createOpponentHands, type OpponentHands } from "./opponent-hands";
import type { Placement } from "./placement";
import type { SeatId } from "./player-characters";
import { createTableCards, type TableCards } from "./table-cards";
import { centredSlots, type TableLayout } from "./table-layout";
import type { SceneView } from "./three-scene";
import { createTrickRewards, type RewardDestination, type TrickRewards } from "./trick-rewards";
import { createTrumpCrown } from "./trump-crown";

export interface CardTableOptions {
  environment: THREE.Object3D;
  view: SceneView;
  layout: TableLayout;
  // Null for the demo table: rounds are dealt at random and plays stay local.
  game: GameConnection | null;
  // The seat a player sits in, or null if they have none.
  seatOf(username: string): SeatId | null;
  // Where the character in a seat has their head, for the trick reward.
  headOf(seat: SeatId): THREE.Vector3 | null;
  // Called when a deal has finished landing.
  onDealDone?(): void;
}

export interface CardTable {
  readonly cards: TableCards;
  readonly deal: CardDeal;
  readonly opponents: OpponentHands;
  readonly rewards: TrickRewards;
  // True from the start of a deal (including waiting for the intro camera
  // move) until its last card has landed.
  readonly dealing: boolean;
  // Call after every game-state update.
  applyState(): void;
  // The server refused an action; a card waiting to be played returns.
  refused(): void;
  // Demo table: gather the cards and deal a fresh random round.
  redealDemo(): void;
  // Demo table: play the trick reward to a random player (you included); the
  // round-end version also gathers the trump and takes its colour.
  playTestReward(roundOver: boolean): void;
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
  headOf,
  onDealDone,
}: CardTableOptions): CardTable {
  const factory = createCardFactory(environment);
  const cards = createTableCards(environment, factory, layout);
  const opponents = createOpponentHands(factory, layout);
  const deal = createCardDeal(factory, layout);
  const rewards = createTrickRewards(environment);
  const crown = createTrumpCrown(environment, view.camera, () => cards.trumpCardObject());

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

  let dealCount = 0;
  let dealPending = false;

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

    // Cards each recipient gets this deal, to centre their slots on the fan.
    const dealtTo = (matches: (planned: PlannedCard) => boolean) => plan.filter(matches).length;
    const localCount = dealtTo((planned) => planned.to !== "trump" && planned.to.kind === "local");

    const steps = plan.flatMap((planned): DealStep[] => {
      const { to, card, slot } = planned;
      if (to === "trump") {
        return layout.trump
          ? [{ target: layout.trump, face: trumpFaceTexture(card, trumpSuit), onLanded: () => cards.holdTrump(false) }]
          : [];
      }
      if (to.kind === "local") {
        const target = centredSlots(layout.localHand, localCount)[slot];
        const key = cardKey(card);
        return target ? [{ target, face: cardTexture(card), onLanded: () => cards.releaseDealt(key) }] : [];
      }
      const seat = to.seat;
      const seatCount = dealtTo((other) => other.to !== "trump" && other.to.kind === "seat" && other.to.seat === seat);
      const target = centredSlots(layout.handFor(seat), seatCount)[slot];
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

    // The cards wait on the stack until the camera's intro move has finished.
    // A newer deal replaces one still waiting.
    const thisDeal = ++dealCount;
    dealPending = true;
    view.whenIntroDone(() => {
      if (thisDeal !== dealCount) return;
      deal.deal(steps, () => {
        for (const seat of shown.keys()) opponents.setShown(seat, null);
        cards.holdForDeal([]);
        cards.holdTrump(false);
        if (thisDeal !== dealCount) return;
        dealPending = false;
        onDealDone?.();
      });
    });
  };

  let dealtRound: number | null = null;
  let clock = 0;
  let rewardedTrick: string | null = null;
  const upcomingRewards: Array<{ at: number; start: () => void }> = [];

  // Gathers the trick's cards (and, after a round's last trick, the trump)
  // into their centre and sends a tesseract to the winner.
  const startReward = (destination: RewardDestination | null, roundOver: boolean, color: string | null) => {
    const trick = cards.trickCardObjects();
    const trumpObject = roundOver ? cards.trumpCardObject() : null;
    const centreOf = (objects: readonly THREE.Object3D[]) =>
      objects
        .reduce((sum, object) => sum.add(object.getWorldPosition(new THREE.Vector3())), new THREE.Vector3())
        .divideScalar(Math.max(objects.length, 1));
    const point = trick.length
      ? centreOf(trick.map((card) => card.object))
      : environment.localToWorld(
          layout.played
            .reduce((sum, slot) => sum.add(slot.position), new THREE.Vector3())
            .divideScalar(Math.max(layout.played.length, 1)),
        );

    rewards.play({
      cards: [...trick.map((card) => card.object), ...(trumpObject ? [trumpObject] : [])],
      point,
      destination,
      color: roundOver ? color : null,
    });
    cards.suppressTrick(trick.map((card) => card.key));
    if (trumpObject) cards.suppressTrump();
  };

  const destinationFor = (winner: string): RewardDestination | null => {
    if (game && winner === game.localUsername) return { kind: "camera", camera: view.camera };
    const seat = seatOf(winner);
    return seat === null ? null : { kind: "head", head: () => headOf(seat) };
  };
  // The trick as last shown; null until the first update, so opening the table
  // mid-trick doesn't replay cards played before you arrived.
  let knownTrick: Set<string> | null = null;
  const rules = new WizardRules();

  const applyState = () => {
    const state = game?.state();
    if (!game || !state) return;
    const firstUpdate = knownTrick === null;

    const hand = localPlayer(game)?.hand ?? [];
    cards.setHand(hand);
    // A card another player has just played rises out of their hand on its
    // way to the table: from the last card showing in their fan, before the
    // hand counts below take it away.
    const origins = new Map<string, Placement>();
    for (const played of state.currentTrick.playedCards) {
      const key = cardKey(played.card);
      if (!knownTrick || knownTrick.has(key) || deal.dealing) continue;
      if (played.username === game.localUsername) continue;
      const seat = seatOf(played.username);
      if (seat === null) continue;
      const showing = opponents.visibleCount(seat);
      const from = centredSlots(layout.handFor(seat), showing)[showing - 1];
      if (from) origins.set(key, from);
    }
    cards.setTrick(state.currentTrick.playedCards.map((played) => played.card), origins);
    knownTrick = new Set(state.currentTrick.playedCards.map((played) => cardKey(played.card)));
    // The card winning the trick so far, by the server's own rules.
    const leader = rules.determineTrickWinner(
      state.currentTrick.playedCards,
      state.trumpSuit,
      state.currentRound === state.totalRounds,
    );
    const leadingPlay = state.currentTrick.playedCards.find((played) => played.username === leader);
    cards.setLeading(leadingPlay ? cardKey(leadingPlay.card) : null);
    cards.setTrump(state.trumpCard, state.trumpSuit);

    // A finished trick: once its last card has landed, its cards gather and
    // the winner gets a tesseract. After a round's last trick the trump goes
    // too, and that tesseract takes the trump colour. Not replayed for a trick
    // already finished when the table opened.
    const trick = state.currentTrick;
    const winner = trick.winnerUsername;
    if (winner && trick.playedCards.length === state.players.length) {
      const trickId = `${state.currentRound}:${trick.playedCards.map((played) => cardKey(played.card)).join(",")}`;
      if (trickId !== rewardedTrick) {
        rewardedTrick = trickId;
        if (!firstUpdate) {
          const roundOver = state.players.every((player) => player.handCount === 0);
          const color = trumpColor(state.trumpSuit);
          upcomingRewards.push({
            at: clock + TRICK_REWARD.startDelaySeconds + TRICK_REWARD.winnerHoldSeconds,
            start: () => startReward(destinationFor(winner), roundOver, color),
          });
        }
      }
    }

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
    demoTrumpSuit = trumpSuit;
    opponents.setCounts(new Map(layout.clockwiseSeats.map((seat) => [seat, DEMO_CARDS_EACH])));
    runDeal(plan, trumpSuit);
  };

  let demoTrumpSuit: Suit | null = null;

  const playTestReward = (roundOver: boolean) => {
    const pick = Math.floor(Math.random() * (layout.clockwiseSeats.length + 1));
    const seat = layout.clockwiseSeats[pick];
    const destination: RewardDestination =
      seat === undefined ? { kind: "camera", camera: view.camera } : { kind: "head", head: () => headOf(seat) };
    startReward(destination, roundOver, trumpColor(demoTrumpSuit));
  };

  const onDealKey = (event: KeyboardEvent) => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === "d") redealDemo();
    else if (key === "t") playTestReward(event.shiftKey);
  };

  if (!game) {
    redealDemo();
    if (import.meta.env.DEV) window.addEventListener("keydown", onDealKey);
  }

  return {
    cards,
    deal,
    opponents,
    rewards,
    get dealing() {
      return dealPending;
    },
    applyState,
    refused: () => cards.cancelPlay(),
    redealDemo,
    playTestReward,
    update(deltaSeconds) {
      clock += deltaSeconds;
      for (let i = upcomingRewards.length - 1; i >= 0; i--) {
        if (clock < upcomingRewards[i].at) continue;
        const [due] = upcomingRewards.splice(i, 1);
        due.start();
      }
      deal.update(deltaSeconds);
      cards.update(deltaSeconds);
      rewards.update(deltaSeconds);
      crown.update(deltaSeconds);
    },
    dispose() {
      controls.dispose();
      crown.dispose();
      window.removeEventListener("keydown", onDealKey);
    },
  };
}
