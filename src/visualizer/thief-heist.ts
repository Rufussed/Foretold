import * as THREE from "three";
import type { Card } from "../../backend/src/game/wizard/models/card";
import type { CardFactory } from "./card-objects";
import { blankCardTexture, cardKey, cardTexture } from "./card-textures";
import { THIEF } from "./config";
import { canAct, isLocalTurn, localPlayer, type GameConnection } from "./game-connection";
import { announcedName } from "./hud/announcements";
import type { OpponentHands } from "./opponent-hands";
import { paced } from "./pace";
import type { Placement } from "./placement";
import type { SeatId } from "./player-characters";
import type { TableCards } from "./table-cards";
import type { SceneView } from "./three-scene";
import { createThiefFlights, type ThiefFlights } from "./thief-flight";
import { setThiefInstruction } from "./thief-instruction";
import { t } from "../i18n";

// Where the winner is in the Thief's three choices: a player, then one of their
// own cards, then one of that player's.
export type HeistStep = "idle" | "target" | "turning" | "own" | "theirs" | "sent";

export interface ThiefHeist {
  step(): HeistStep;
  // The players whose hands can be robbed, and the one chosen.
  targets(): string[];
  target(): string | null;
  chooseTarget(username: string): void;
  // The winner leaves the Thief unused.
  pass(): void;
  // The server refused a choice; pick again.
  refused(): void;
  // Call at the start of every card table update, before the hand is set.
  applyState(): void;
  // Plays the swap the last snapshot showed; done once the cards have landed
  // and the target's fan has settled.
  playSwap(done: () => void): void;
  update(deltaSeconds: number): void;
  // Called when the step changes, so the prompt can follow.
  onChange(listener: () => void): void;
  dispose(): void;
}

export interface ThiefHeistOptions {
  game: GameConnection | null;
  view: SceneView;
  environment: THREE.Object3D;
  factory: CardFactory;
  cards: TableCards;
  opponents: OpponentHands;
  seatOf(username: string): SeatId | null;
  // Turns the camera to a player, or back to the normal view with null.
  lookAt(username: string | null, done: () => void, seconds?: number): void;
  // A line for the announcement box.
  notice(text: string): void;
}

// The swap as the last snapshot showed it, worked out before the hand was set
// so the old card could still be found.
interface Swap {
  winner: string;
  target: string;
  ownIndex: number;
  targetIndex: number;
  // Cards you know, if you are in the swap: the one you lost, where it was,
  // and the one you gained.
  lost: { card: Card; from: Placement } | null;
  gained: Card | null;
}

// Winning a trick with the Thief: choosing a player, bringing their hand up for
// the winner to pick from, and showing the swap to everyone at the table.
export function createThiefHeist(options: ThiefHeistOptions): ThiefHeist {
  const { game, view, environment, factory, cards, opponents, seatOf } = options;
  const flights: ThiefFlights = createThiefFlights(environment, factory, view.camera);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const up = new THREE.Vector3(0, 1, 0).transformDirection(environment.matrixWorld.clone().invert());
  const listeners: Array<() => void> = [];

  let step: HeistStep = "idle";
  let target: string | null = null;
  let ownKey: string | null = null;
  let hoveredIndex = -1;
  let pending: Swap | null = null;
  let lastHand: readonly Card[] = [];
  let seenSwap: string | null = null;
  let toldAbout: string | null = null;
  let applied = false;
  // Which approach to a target is current, so one that was abandoned does not
  // carry on.
  let approachId = 0;

  // The line the announcement box shows for the step the winner is on.
  const instructionFor = (): string | null => {
    if (step === "target") return t("game.thiefPrompt");
    if (step === "own") return t("game.thiefOwn");
    if (step === "theirs") return t("game.thiefTheirs", { name: announcedName(target ?? "") });
    return null;
  };
  const changed = () => {
    setThiefInstruction(instructionFor());
    listeners.forEach((listener) => listener());
  };
  const setStep = (next: HeistStep) => {
    if (step === next) return;
    step = next;
    changed();
  };

  const trickId = (state: NonNullable<ReturnType<GameConnection["state"]>>) =>
    `${state.currentRound}:${state.currentTrick.playedCards.map((played) => cardKey(played.card)).join(",")}`;

  const metre = 1 / (environment.getWorldScale(new THREE.Vector3()).x || 1);

  // The fan as it lies at home, brought round to face away from you, over your
  // own fan: the same layout, card for card, so nothing crosses or spreads as
  // it comes. Your hand's slots, turned half way about their middle, are that
  // layout, since your fan is the same fan seen from the other side.
  const presentedSlots = (count: number): Placement[] => {
    const slots = cards.frameSlots(count);
    const centre = slots
      .reduce((sum, slot) => sum.add(slot.position), new THREE.Vector3())
      .divideScalar(Math.max(slots.length, 1));
    const half = new THREE.Quaternion().setFromAxisAngle(up, Math.PI);
    return slots.map((slot) => ({
      position: slot.position
        .clone()
        .sub(centre)
        .applyQuaternion(half)
        .add(centre)
        .addScaledVector(up, THIEF.fanLiftLengths * factory.length * slot.scale.z + THIEF.fanExtraMetres * metre),
      quaternion: half.clone().multiply(slot.quaternion),
      scale: slot.scale.clone(),
    }));
  };
  const clearHover = () => {
    if (target === null) return;
    const seat = seatOf(target);
    if (seat === null || hoveredIndex < 0) return;
    const card = opponents.cardObject(seat, hoveredIndex);
    if (card) card.outline.visible = false;
    hoveredIndex = -1;
  };

  const lowerOwn = () => {
    if (ownKey) cards.setRaised(ownKey, false);
    ownKey = null;
  };

  const sendHome = () => {
    clearHover();
    const seat = target === null ? null : seatOf(target);
    if (seat !== null) opponents.present(seat, null, paced(THIEF.fanSeconds));
  };

  const reset = () => {
    approachId += 1;
    sendHome();
    lowerOwn();
    target = null;
    setStep("idle");
  };

  // Where a pointer event is aimed.
  const aim = (event: PointerEvent) => {
    const rect = view.canvas.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, view.camera);
  };

  // The index in the target's fan of the card under the pointer, if any.
  const opponentCardAt = (): number => {
    const seat = target === null ? null : seatOf(target);
    if (seat === null) return -1;
    let best = -1;
    let bestDistance = Infinity;
    for (let index = 0; index < opponents.visibleCount(seat); index++) {
      const card = opponents.cardObject(seat, index);
      if (!card) continue;
      const hit = raycaster.intersectObject(card.object, true)[0];
      if (hit && hit.distance < bestDistance) {
        best = index;
        bestDistance = hit.distance;
      }
    }
    return best;
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || (step !== "own" && step !== "theirs")) return;
    aim(event);

    if (step === "theirs") {
      const index = opponentCardAt();
      if (index < 0) return;
      event.stopImmediatePropagation();
      const hand = game ? localPlayer(game)?.hand ?? [] : [];
      const ownIndex = hand.findIndex((card) => cardKey(card) === ownKey);
      if (ownIndex < 0 || !game?.send({ type: "steal_card", ownIndex, targetIndex: index })) return;
      setStep("sent");
      return;
    }

    const key = cards.cardAt(raycaster);
    if (!key) return;
    event.stopImmediatePropagation();
    ownKey = key;
    // Lifted, as when reading a card, so it is clear which one is going.
    cards.setRaised(key, true);
    setStep("theirs");
  };

  const onPointerMove = (event: PointerEvent) => {
    if (step !== "theirs") return;
    aim(event);
    const index = opponentCardAt();
    if (index === hoveredIndex) return;
    clearHover();
    const seat = target === null ? null : seatOf(target);
    const card = seat === null || index < 0 ? null : opponents.cardObject(seat, index);
    if (card) {
      card.outline.visible = true;
      hoveredIndex = index;
    }
    view.canvas.style.cursor = card ? "pointer" : "";
  };

  view.canvas.addEventListener("pointerdown", onPointerDown, { capture: true });
  view.canvas.addEventListener("pointermove", onPointerMove);

  // Whether the local player has a Thief to use right now.
  const mine = () => {
    const state = game?.state();
    const power = state?.currentTrick.power;
    return !!game && !!state && !!power && power.kind === "thief" && !power.resolved &&
      state.phase === "power" && power.username === game.localUsername && canAct(game) && isLocalTurn(game);
  };

  const homePlace = (username: string, index: number): Placement | null => {
    const seat = seatOf(username);
    return seat === null ? null : opponents.homePlacement(seat, index);
  };
  const livePlace = (username: string, index: number): Placement | null => {
    const seat = seatOf(username);
    return seat === null ? null : opponents.placementOf(seat, index);
  };
  const handSlot = (key: string): Placement | null => {
    const order = cards.handOrder();
    return cards.frameSlots(order.length)[order.indexOf(key)] ?? null;
  };

  // The camera turns to the player first, and only once it is there does their
  // fan rise and come forward; the winner is told to choose a card when it has.
  const approach = (username: string) => {
    const seat = seatOf(username);
    if (seat === null) return;
    const id = ++approachId;
    target = username;
    setStep("turning");
    options.lookAt(
      username,
      () => {
        if (id !== approachId) return;
        opponents.present(seat, presentedSlots, paced(THIEF.fanSeconds));
        window.setTimeout(() => {
          if (id !== approachId || step !== "turning") return;
          // With one card in each hand there is nothing to choose: the swap
          // plays through by itself.
          const hand = game ? localPlayer(game)?.hand ?? [] : [];
          const theirs = game?.state()?.players.find((player) => player.username === username)?.handCount ?? 0;
          if (hand.length === 1 && theirs === 1 && game?.send({ type: "steal_card", ownIndex: 0, targetIndex: 0 })) {
            setStep("sent");
            return;
          }
          setStep("own");
        }, paced(THIEF.fanSeconds) * 1000);
      },
      THIEF.cameraSeconds,
    );
  };

  // Reads a freshly resolved swap out of the snapshot, before the hand changes.
  const notice = () => {
    const state = game?.state();
    if (!game || !state) return;
    const power = state.currentTrick.power;
    const id = trickId(state);

    if (power?.kind === "thief" && !power.resolved && power.target === game.localUsername && toldAbout !== id) {
      toldAbout = id;
      options.notice(t("ann.thiefTargetsYou", { name: announcedName(power.username) }));
    }

    const done = power?.kind === "thief" && power.resolved && power.target !== null &&
      power.ownIndex != null && power.targetIndex != null;
    if (!done || !power || power.target === null || power.ownIndex == null || power.targetIndex == null) return;
    if (seenSwap === id) return;
    seenSwap = id;
    // Joining a game partway: the swap was over before you arrived.
    if (!applied) return;

    const swap: Swap = {
      winner: power.username,
      target: power.target,
      ownIndex: power.ownIndex,
      targetIndex: power.targetIndex,
      lost: null,
      gained: null,
    };
    const hand = localPlayer(game)?.hand ?? [];
    const mineIndex = power.username === game.localUsername ? power.ownIndex : power.target === game.localUsername ? power.targetIndex : -1;
    if (mineIndex >= 0 && lastHand[mineIndex] && hand[mineIndex]) {
      const lostCard = lastHand[mineIndex];
      const from = cards.placementOf(cardKey(lostCard));
      if (from) {
        swap.lost = { card: lostCard, from };
        swap.gained = hand[mineIndex];
        // The new card arrives by flight.
        const heldKey = cardKey(hand[mineIndex]);
        cards.holdForSwap([heldKey]);
        // However the swap ends, the card must not stay hidden.
        window.setTimeout(() => cards.releaseSwapped(heldKey), 12000);
      }
    }
    pending = swap;
  };

  return {
    step: () => step,
    target: () => target,

    targets() {
      const state = game?.state();
      return (state?.players ?? [])
        .filter((player) => player.username !== game?.localUsername && player.handCount > 0)
        .map((player) => player.username);
    },

    chooseTarget(username) {
      if (!game || seatOf(username) === null || step === "sent" || step === "turning") return;
      if (!game.send({ type: "choose_thief_target", target: username })) return;
      // A change of mind: the last player's fan goes home first.
      if (target !== null && target !== username) sendHome();
      approach(username);
    },

    pass() {
      if (!game?.send({ type: "skip_power" })) return;
      options.lookAt(null, () => {}, THIEF.cameraSeconds);
      reset();
    },

    refused() {
      if (step !== "sent") return;
      setStep("theirs");
    },

    applyState() {
      notice();
      const active = mine();
      if (!active && step !== "idle" && (step !== "sent" || !pending)) reset();
      if (active && step === "idle") {
        // Back at the table with a target already chosen, e.g. after a reload.
        const chosen = game?.state()?.currentTrick.power?.target ?? null;
        if (chosen && seatOf(chosen) !== null) {
          approach(chosen);
        } else {
          step = "target";
          changed();
        }
      }
      if (game) lastHand = localPlayer(game)?.hand ?? lastHand;
      applied = true;
    },

    playSwap(done) {
      const swap = pending;
      pending = null;
      const me = game?.localUsername;
      if (!swap || !me) {
        done();
        return;
      }

      const winnerIsMe = swap.winner === me;
      const targetIsMe = swap.target === me;
      const gained = swap.gained;
      const gainedKey = gained ? cardKey(gained) : null;
      const intoHand = () => (gainedKey ? handSlot(gainedKey) : null);
      // Your own lost card starts where it was; the fans are asked each frame,
      // since the target's is still settling.
      const lostFrom = swap.lost ? swap.lost.from : null;
      const winnerFan = () => homePlace(swap.winner, swap.ownIndex);
      const targetFan = () => (winnerIsMe ? livePlace(swap.target, swap.targetIndex) : homePlace(swap.target, swap.targetIndex));
      const face = (card: Card | null | undefined) => (card ? cardTexture(card) : blankCardTexture());

      // The fan cards the two have swapped for are hidden while theirs are in the
      // air, and appear, new, as the flights land. Your own cards are held by the
      // table.
      const emptied: Array<[SeatId, number]> = [];
      const empty = (username: string, index: number) => {
        const seat = seatOf(username);
        if (seat === null) return;
        opponents.setHidden(seat, index, true);
        emptied.push([seat, index]);
      };
      if (!winnerIsMe) empty(swap.winner, swap.ownIndex);
      if (!targetIsMe) empty(swap.target, swap.targetIndex);

      let landed = 0;
      const landOne = () => {
        landed += 1;
        if (landed < 2) return;
        for (const [seat, index] of emptied) opponents.setHidden(seat, index, false);
        if (gainedKey) cards.releaseSwapped(gainedKey);
        // The target's fan settles back before the table moves on.
        const seat = seatOf(swap.target);
        if (winnerIsMe && seat !== null) opponents.present(seat, null, paced(THIEF.fanSeconds));
        target = null;
        ownKey = null;
        setStep("idle");
        window.setTimeout(done, winnerIsMe ? paced(THIEF.fanSeconds) * 1000 : 0);
      };

      // Your own card passes on your left, the other on your right.
      const winnerSide = targetIsMe ? 1 : -1;
      // The winner's card goes to the target's hand...
      flights.fly({
        texture: face(winnerIsMe ? swap.lost?.card : targetIsMe ? gained : null),
        from: winnerIsMe && lostFrom ? () => lostFrom : winnerFan,
        to: targetIsMe ? intoHand : targetFan,
        side: winnerSide,
        done: landOne,
      });
      // ...and the target's to the winner's.
      flights.fly({
        texture: face(targetIsMe ? swap.lost?.card : winnerIsMe ? gained : null),
        from: targetIsMe && lostFrom ? () => lostFrom : targetFan,
        to: winnerIsMe ? intoHand : winnerFan,
        side: winnerSide === 1 ? -1 : 1,
        done: landOne,
      });
    },

    update(deltaSeconds) {
      flights.update(deltaSeconds);
    },

    onChange(listener) {
      listeners.push(listener);
    },

    dispose() {
      flights.dispose();
      view.canvas.removeEventListener("pointerdown", onPointerDown, { capture: true });
      view.canvas.removeEventListener("pointermove", onPointerMove);
    },
  };
}
