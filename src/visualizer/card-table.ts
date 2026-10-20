import * as THREE from "three";
import { WizardRules } from "../../backend/src/game/wizard/services/wizardRules";
import { normalizeGameOptions } from "../../backend/src/game/wizard/gameOptions";
import type { Card } from "../../backend/src/game/wizard/models/card";
import { createBlindCardControls } from "./blind-card-controls";
import { createBlindCards, type BlindCards, type BlindHolder } from "./blind-cards";
import { createBlindPlacements } from "./blind-placements";
import { createCardControls } from "./card-controls";
import { createCardSound } from "./card-sound";
import { createCardDeal, type CardDeal, type DealStep } from "./card-deal";
import { createCardFactory } from "./card-objects";
import { cardKey, cardTexture } from "./card-textures";
import { CARD_HANDLING } from "./config";
import { planDeal, type PlannedCard, type Recipient } from "./deal-plan";
import { canAct, isLocalTurn, localPlayer, type GameConnection } from "./game-connection";
import { createOpponentHands, type OpponentHands } from "./opponent-hands";
import type { Placement } from "./placement";
import type { SeatId } from "./player-characters";
import { createTableCards, type TableCards } from "./table-cards";
import { centredSlots, type TableLayout } from "./table-layout";
import type { SceneView } from "./three-scene";
import { burstColorFor, burstCss, createRewardBurst, type BurstColor } from "./reward-burst";
import { createChimeSound } from "./chime-sound";
import { createScoreSound } from "./score-sound";
import { createTrickRewards, type RewardDestination, type TrickRewards } from "./trick-rewards";
//I want to take the crown out of the trump card, commented out all the crown word in file
// import { createTrumpCrown } from "./trump-crown";

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
  // How the character in a seat has their head turned, for a blind round's
  // card held to it.
  headTurnOf(seat: SeatId): THREE.Quaternion | null;
  headRadiusOf(seat: SeatId): number | null;
  // Called when a deal has finished landing.
  onDealDone?(): void;
  // Called when another player's card takes the lead in the trick, with the
  // player who was leading.
  onOvertaken?(previousLeader: string): void;
}

export interface CardTable {
  readonly cards: TableCards;
  readonly deal: CardDeal;
  readonly opponents: OpponentHands;
  // A blind round's cards, held facing away from their holders.
  readonly blind: BlindCards;
  readonly rewards: TrickRewards;
  // True from the start of a deal (including waiting for the intro camera
  // move) until its last card has landed.
  readonly dealing: boolean;
  // Call after every game-state update.
  applyState(): void;
  // Live games: the finished trick's cards gather (with the trump, after a
  // round's last trick) and a tesseract goes to its winner; done once it has.
  playTrickReward(done: () => void): void;
  // The server refused an action; a card waiting to be played returns.
  refused(): void;
  // Demo table: gather the cards and deal a fresh random round.
  redealDemo(): void;
  // Demo table: play the trick reward to a random player (you included); the
  // round-end version also gathers the trump and takes its colour.
  playTestReward(roundOver: boolean): void;
  // The chime that goes with a burst: bright for "win", the falling one for
  // "lose" (the red tesseract's).
  playChime(outcome: "win" | "lose"): void;
  update(deltaSeconds: number): void;
  dispose(): void;
}

const DEMO_CARDS_EACH = 9;

// Everything cards: connects the stack and dealing, your hand and its pointer
// controls, the other players' hands, a blind round's held cards, the trick
// and the trump to the game.
// A new round is dealt from the stack; a card dropped on the play area is sent
// to the server as your play.
export function createCardTable({
  environment,
  view,
  layout,
  game,
  seatOf,
  headOf,
  headTurnOf,
  headRadiusOf,
  onDealDone,
  onOvertaken,
}: CardTableOptions): CardTable {
  const cameraPosition = new THREE.Vector3();
  const factory = createCardFactory(environment);
  const cards = createTableCards(environment, factory, layout);
  const opponents = createOpponentHands(factory, layout);
  const blind = createBlindCards(
    factory,
    createBlindPlacements({ environment, layout, camera: () => view.camera, headOf, headTurnOf, headRadiusOf }),
  );
  const sound = createCardSound();
  const deal = createCardDeal(factory, layout, sound);
  const scoreSound = createScoreSound();
  const burst = createRewardBurst(environment);
  const chime = createChimeSound();
  const rewards = createTrickRewards(environment, { sound: scoreSound, burst, chime });
  // const crown = createTrumpCrown(environment, view.camera, () => cards.trumpCardObject());

  // Only on your turn while cards are being played; the server has the final
  // say either way. Always allowed on the demo table.
  const canPlay = () => !game || (game.state()?.phase === "playing" && canAct(game) && isLocalTurn(game));

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

  // A blind round's one card is played unseen: it is the only card in the
  // hand, so its index is 0.
  const blindControls = createBlindCardControls({
    canvas: view.canvas,
    camera: view.camera,
    blind,
    holdOrbit: view.holdOrbit,
    canPlay: () => !!game?.state()?.blindRound && canPlay(),
    // The same play line as your hand's: above your middle hand slot.
    playLine: () => {
      const slot = centredSlots(layout.localHand, 1)[0];
      if (!slot) return null;
      const up = new THREE.Vector3(0, 1, 0).transformDirection(environment.matrixWorld.clone().invert());
      return environment.localToWorld(
        slot.position.clone().addScaledVector(up, CARD_HANDLING.playLineLengths * factory.length * slot.scale.z),
      );
    },
    onPlay: () => !!game?.send({ type: "play_card", cardIndex: 0 }),
  });

  let dealCount = 0;
  let dealPending = false;

  // Runs a planned deal: hides whatever is about to arrive, then reveals each
  // card as it lands. A blind round deals everyone's card to their blind-card
  // target instead of their hand.
  const runDeal = (plan: readonly PlannedCard[], blindRound = false) => {
    deal.reset();

    const holderOf = (to: Recipient): BlindHolder => (to.kind === "local" ? "local" : to.seat);
    blind.holdForDeal(
      blindRound ? plan.flatMap((planned) => (planned.to === "trump" ? [] : [holderOf(planned.to)])) : [],
    );

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
          ? [{ target: layout.trump, face: cardTexture(card), onLanded: () => cards.holdTrump(false) }]
          : [];
      }
      if (blindRound) {
        const holder = holderOf(to);
        return [{
          target: () => blind.slotFor(holder),
          // Your own lands with its back to you, unseen.
          face: holder === "local" ? null : cardTexture(card),
          onLanded: () => blind.releaseDealt(holder),
        }];
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
        blind.holdForDeal([]);
        cards.holdTrump(false);
        if (thisDeal !== dealCount) return;
        dealPending = false;
        onDealDone?.();
      });
    });
  };

  let dealtRound: number | null = null;

  // Gathers the trick's cards (and, after a round's last trick, the trump)
  // into their centre and sends a tesseract to the winner.
  const startReward = (
    destination: RewardDestination | null,
    roundOver: boolean,
    burstColor: BurstColor,
    done?: () => void,
  ) => {
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
      // The tesseract and the burst share one colour, from the winner's tricks against their prediction.
      color: burstCss(burstColor),
      burstColor,
    }, done);
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
  // Who was winning the trick at the last update, to notice a change of lead.
  let lastLeader: string | null = null;
  const rules = new WizardRules();

  const applyState = () => {
    const state = game?.state();
    if (!game || !state) return;

    const hand = localPlayer(game)?.hand ?? [];
    cards.setHand(hand);
    // In a blind round every card is held up to its holder's forehead, and you
    // can see every card but your own.
    const blindRound = !!state.blindRound;
    const holderOf = (username: string): BlindHolder | null =>
      username === game.localUsername ? "local" : seatOf(username);
    const holdings = new Map<BlindHolder, Card | null>();
    for (const player of blindRound ? state.players : []) {
      const holder = holderOf(player.username);
      if (holder === null || player.handCount === 0) continue;
      holdings.set(holder, holder === "local" ? null : player.hand[0] ?? null);
    }

    // Which played-card slots the trick uses: centred for fewer than six.
    cards.setPlayerCount(state.players.length);
    // A card another player has just played rises out of their hand on its
    // way to the table: from the last card showing in their fan, before the
    // hand counts below take it away. In a blind round every card, yours
    // included, comes from where it was held.
    const origins = new Map<string, Placement>();
    for (const played of state.currentTrick.playedCards) {
      const key = cardKey(played.card);
      if (!knownTrick || knownTrick.has(key) || deal.dealing) continue;
      if (blindRound) {
        const holder = holderOf(played.username);
        if (holder !== null) origins.set(key, blind.heldAt(holder));
        continue;
      }
      if (played.username === game.localUsername) continue;
      const seat = seatOf(played.username);
      if (seat === null) continue;
      const showing = opponents.visibleCount(seat);
      const from = centredSlots(layout.handFor(seat), showing)[showing - 1];
      if (from) origins.set(key, from);
    }
    // Watching your NPC: its plays rise out of your hand like everyone else's.
    const fromHand = new Set(
      canAct(game)
        ? []
        : state.currentTrick.playedCards
            .filter((played) => played.username === game.localUsername)
            .map((played) => cardKey(played.card)),
    );
    cards.setTrick(state.currentTrick.playedCards.map((played) => played.card), origins, fromHand);
    // Only now, so a card just played flies from where it was, dropped or held.
    blind.set(holdings);
    knownTrick = new Set(state.currentTrick.playedCards.map((played) => cardKey(played.card)));
    // The card winning the trick so far, by the server's own rules.
    const leader = rules.determineTrickWinner(
      state.currentTrick.playedCards,
      state.trumpSuit,
      normalizeGameOptions(state.options).wizardWins,
    );
    const leadingPlay = state.currentTrick.playedCards.find((played) => played.username === leader);
    cards.setLeading(leadingPlay ? cardKey(leadingPlay.card) : null);
    const newLeader = leadingPlay ? leader : null;
    if (lastLeader && newLeader && newLeader !== lastLeader) onOvertaken?.(lastLeader);
    lastLeader = newLeader;
    cards.setTrump(state.trumpCard, state.trumpSuit);

    // A finished trick's reward waits for the table director
    // (playTrickReward), in step with the camera and announcements.

    const counts = new Map<SeatId, number>();
    for (const player of state.players) {
      if (player.username === game.localUsername) continue;
      const seat = seatOf(player.username);
      // A blind round's cards are held up, not fanned in the hand.
      if (seat !== null) counts.set(seat, blindRound ? 0 : player.handCount);
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

    // A blind round's deal shows the others' cards and hides yours.
    const seatHands = new Map<SeatId, readonly Card[]>();
    for (const player of blindRound ? state.players : []) {
      const seat = player.username === game.localUsername ? null : seatOf(player.username);
      if (seat !== null && player.hand.length) seatHands.set(seat, player.hand);
    }
    runDeal(
      planDeal({
        recipients,
        cardsEach: state.currentRound,
        localHand: blindRound ? null : localHand,
        seatHands,
        trump: state.trumpCard,
      }),
      blindRound,
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
    // The demo seats every character in the scene, plus you.
    cards.setPlayerCount(layout.clockwiseSeats.length + 1);
    cards.setTrick([]);
    cards.setHand([]);
    cards.setHand(localCards);
    cards.setTrump(trumpCard, trumpSuit);
    opponents.setCounts(new Map(layout.clockwiseSeats.map((seat) => [seat, DEMO_CARDS_EACH])));
    runDeal(plan);
  };

  const playTestReward = (roundOver: boolean) => {
    const pick = Math.floor(Math.random() * (layout.clockwiseSeats.length + 1));
    const seat = layout.clockwiseSeats[pick];
    const destination: RewardDestination =
      seat === undefined ? { kind: "camera", camera: view.camera } : { kind: "head", head: () => headOf(seat) };
    // The demo table has no predictions, so the test reward acts out a prediction of 3 with 1 to 4 tricks won: green, deeper green, gold, red.
    startReward(destination, roundOver, burstColorFor(1 + Math.floor(Math.random() * 4), 3));
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
    blind,
    rewards,
    get dealing() {
      return dealPending;
    },
    applyState,
    playTrickReward(done) {
      const winner = game?.state()?.currentTrick.winnerUsername;
      const state = game?.state();
      if (!winner || !state) {
        done();
        return;
      }
      const roundOver = state.players.every((player) => player.handCount === 0);
      const won = state.players.find((player) => player.username === winner);
      const burstColor = won ? burstColorFor(won.tricksWon, won.prediction) : burstColorFor(0, null);
      startReward(destinationFor(winner), roundOver, burstColor, done);
    },
    refused: () => {
      cards.cancelPlay();
      blind.cancelPlay();
    },
    redealDemo,
    playTestReward,
    update(deltaSeconds) {
      deal.update(deltaSeconds);
      cards.setHandFrame(view.cameraYaw(), view.camera.getWorldPosition(cameraPosition));
      cards.update(deltaSeconds);
      blind.update();
      rewards.update(deltaSeconds);
      burst.update(deltaSeconds);
      // crown.update(deltaSeconds);
    },
    playChime(outcome) {
      chime.play(outcome);
    },

    dispose() {
      controls.dispose();
      blindControls.dispose();
      sound.dispose();
      scoreSound.dispose();
      chime.dispose();
      burst.dispose();
      // crown.dispose();
      window.removeEventListener("keydown", onDealKey);
    },
  };
}
