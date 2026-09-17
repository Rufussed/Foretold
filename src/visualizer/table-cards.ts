import * as THREE from "three";
import type { Card, Suit } from "../../backend/src/game/wizard/models/card";
import type { CardFactory } from "./card-objects";
import { cardKey, cardTexture, trumpColor, trumpFaceTexture } from "./card-textures";
import { CARD_HANDLING, OPPONENT_PLAYS } from "./config";
import { applyPlacement, type Placement } from "./placement";
import { centredSlots, type TableLayout } from "./table-layout";

export interface HandTarget {
  key: string;
  home: THREE.Vector3; // world position in its hand slot
  raised: THREE.Vector3; // world position when raised to be read
  // Drop a dragged card above this to play it (CARD_HANDLING.playLineLengths).
  playLine: THREE.Vector3;
}

export interface TableCards {
  // Your hand, from game state. The order you've arranged cards still in hand
  // is kept; new cards join at the end, so a fresh deal arrives in server order.
  setHand(cards: readonly Card[]): void;
  // Cards played in the current trick, in play order. A newly played card
  // with an origin (the spot in another player's hand it came from) rises out
  // of it first, then turns into place on its played-card slot.
  // flyFromHand: cards played from your own hand by the server (your NPC, when
  // watching), which rise and fly from where they sit like other players' do.
  setTrick(
    cards: readonly Card[],
    origins?: ReadonlyMap<string, Placement>,
    flyFromHand?: ReadonlySet<string>,
  ): void;
  // The turned-up trump card, painted in the trump suit's colour; null hides it.
  setTrump(card: Card | null, trumpSuit: Suit | null): void;
  update(deltaSeconds: number): void;

  // The whole hand in your arranged order, including cards still being dealt.
  handOrder(): string[];
  // Hides these hand cards until each is dealt to you with releaseDealt; an
  // empty list releases any still held.
  holdForDeal(keys: readonly string[]): void;
  releaseDealt(key: string): void;
  // Keeps the trump card hidden while it's being dealt.
  holdTrump(held: boolean): void;

  // The cards showing in the trick, in play order, and the trump card if it's
  // showing: for the end-of-trick reward, which gathers copies of them.
  trickCardObjects(): Array<{ key: string; object: THREE.Object3D }>;
  trumpCardObject(): THREE.Object3D | null;
  // Outlines this trick card, the one winning so far, as hovering does; null for none.
  setLeading(key: string | null): void;
  // Hides these trick cards until they leave the trick.
  suppressTrick(keys: readonly string[]): void;
  // Hides the trump card until a different trump is set or a deal begins.
  suppressTrump(): void;

  // The hand card under a ray, if any.
  cardAt(raycaster: THREE.Raycaster): string | null;
  setHovered(key: string | null): void;
  toggleRaised(key: string): void;
  positionOf(key: string): THREE.Vector3 | null;
  startDrag(key: string): void;
  dragTo(key: string, world: THREE.Vector3): void;
  endDrag(key: string): void;
  handTargets(): HandTarget[];
  moveInHand(key: string, index: number): void;
  // Sends a hand card to the next free played slot; false if it can't go.
  play(key: string): boolean;
  // The pending play was refused: the card returns to the hand.
  cancelPlay(): void;
  // Accepts the pending play locally, for the demo table with no server.
  confirmPlay(): void;
  // Development aid: what the trump target shows.
  debugTrump(): { visible: boolean; card: string | null; color: string | null };
  // Development aid.
  debug(): Array<{
    key: string;
    place: "hand" | "dealing" | "pending" | "trick" | "none";
    index: number;
    raised: boolean;
    dragging: boolean;
    outline: boolean;
    visible: boolean;
  }>;
}

interface TableCard {
  key: string;
  object: THREE.Object3D;
  outline: THREE.Mesh;
  raised: boolean;
  drag: THREE.Vector3 | null; // environment-local position while dragged
  placed: boolean;
  flight: { from: Placement; startedAt: number } | null; // another player's play
}

const smooth = (x: number) => {
  const t = Math.min(Math.max(x, 0), 1);
  return t * t * (3 - 2 * t);
};

// Your hand on card01..card20, the trick on played-card-1..6 and the trump:
// card objects that glide between those targets.
export function createTableCards(
  environment: THREE.Object3D,
  factory: CardFactory,
  layout: TableLayout,
): TableCards {
  const handSlots = layout.localHand;
  const playedSlots = layout.played;
  const trumpSlot = layout.trump;
  const up = new THREE.Vector3(0, 1, 0).transformDirection(environment.matrixWorld.clone().invert());
  const liftFor = (slot: Placement) => CARD_HANDLING.raiseLengths * factory.length * slot.scale.z;

  const cards = new Map<string, TableCard>();
  let handOrder: string[] = [];
  let trickOrder: string[] = [];
  let pending: { key: string; since: number } | null = null;
  let hovered: string | null = null;
  let leading: string | null = null;
  let held = new Set<string>();
  let trumpHeld = false;
  const suppressed = new Set<string>();
  let trumpSuppressed = false;
  let clock = 0;
  let warnedOverflow = false;

  const ensure = (card: Card): TableCard => {
    const key = cardKey(card);
    const existing = cards.get(key);
    if (existing) return existing;

    const { object, outline } = factory.build(`table-card-${key}`, cardTexture(card));
    object.userData.cardKey = key;
    const entry: TableCard = {
      key,
      object,
      outline,
      raised: false,
      drag: null,
      placed: false,
      flight: null,
    };
    cards.set(key, entry);
    return entry;
  };

  let trump: {
    object: THREE.Object3D;
    face: THREE.MeshStandardMaterial | null;
    card: string | null;
    color: string | null;
  } | null = null;

  // Another player's card: up out of their hand, then over to its slot while
  // turning face up. Returns false once it has arrived.
  const flyFromHand = (entry: TableCard, slot: Placement): boolean => {
    const flight = entry.flight;
    if (!flight) return false;
    const lift = Math.max(OPPONENT_PLAYS.liftSeconds, 1e-6);
    const travel = Math.max(OPPONENT_PLAYS.travelSeconds, 1e-6);
    const t = clock - flight.startedAt;
    const raised = flight.from.position
      .clone()
      .addScaledVector(up, OPPONENT_PLAYS.liftLengths * factory.length * flight.from.scale.z);

    if (t < lift) {
      entry.object.position.lerpVectors(flight.from.position, raised, smooth(t / lift));
      entry.object.quaternion.copy(flight.from.quaternion);
      return true;
    }
    if (t < lift + travel) {
      const k = smooth((t - lift) / travel);
      entry.object.position.lerpVectors(raised, slot.position, k);
      entry.object.quaternion.slerpQuaternions(flight.from.quaternion, slot.quaternion, k);
      entry.object.scale.copy(slot.scale);
      return true;
    }
    entry.flight = null;
    applyPlacement(entry.object, slot);
    return false;
  };

  // The trick as last set, so a card flies from the hand only once.
  let trickOrderShown = new Set<string>();

  const visibleHand = () => handOrder.filter((key) => key !== pending?.key && !held.has(key));

  // A hand card's slot: centred for the whole hand, cards still being dealt
  // included, so each lands where it stays and nothing shifts mid-deal.
  const handSlotFor = (key: string): Placement | undefined => {
    const hand = handOrder.filter((candidate) => candidate !== pending?.key);
    return centredSlots(handSlots, hand.length)[hand.indexOf(key)];
  };

  const targetOf = (entry: TableCard): { slot: Placement; lift: number } | null => {
    if (visibleHand().includes(entry.key)) {
      const slot = handSlotFor(entry.key);
      return slot ? { slot, lift: entry.raised ? liftFor(slot) : 0 } : null;
    }
    if (pending?.key === entry.key) {
      const slot = playedSlots[trickOrder.length];
      return slot ? { slot, lift: 0 } : null;
    }
    const slot = playedSlots[trickOrder.indexOf(entry.key)];
    return slot ? { slot, lift: 0 } : null;
  };

  return {
    setHand(cardsInHand) {
      const byKey = new Map(cardsInHand.map((card) => [cardKey(card), card]));
      const kept = handOrder.filter((key) => byKey.has(key));
      const added = [...byKey.keys()].filter((key) => !kept.includes(key));
      handOrder = [...kept, ...added];

      if (handOrder.length > handSlots.length && !warnedOverflow) {
        warnedOverflow = true;
        console.warn(`[cards] ${handOrder.length} cards in hand but only ${handSlots.length} slots`);
      }

      for (const card of byKey.values()) ensure(card);
      for (const entry of cards.values()) {
        if (byKey.has(entry.key)) continue;
        entry.raised = false;
        entry.drag = null;
      }
      // A card that has left the hand has been played.
      if (pending && !byKey.has(pending.key)) pending = null;
      if (hovered && !byKey.has(hovered)) hovered = null;
    },

    setTrump(card, trumpSuit) {
      if (!trumpSlot) return;
      if (!card) {
        trumpSuppressed = false;
        if (trump) {
          trump.object.visible = false;
          trump.card = null;
          trump.color = null;
        }
        return;
      }

      const texture = trumpFaceTexture(card, trumpSuit);
      if (!trump) {
        const built = factory.build("trump-card-face", texture);
        applyPlacement(built.object, trumpSlot);
        trump = { object: built.object, face: built.face, card: null, color: null };
      }
      if (trump.face) trump.face.map = texture;
      if (trump.card !== cardKey(card)) trumpSuppressed = false;
      trump.object.visible = !trumpHeld && !trumpSuppressed;
      trump.card = cardKey(card);
      trump.color = trumpColor(trumpSuit);
    },

    setTrick(cardsPlayed, origins, flyFromHand) {
      trickOrder = cardsPlayed.map(cardKey);
      for (const key of [...suppressed]) {
        if (!trickOrder.includes(key)) suppressed.delete(key);
      }
      for (const card of cardsPlayed) {
        const entry = ensure(card);
        const inHand = flyFromHand?.has(entry.key) && entry.placed && !entry.flight && !trickOrderShown.has(entry.key);
        const from = inHand
          ? {
              position: entry.object.position.clone(),
              quaternion: entry.object.quaternion.clone(),
              scale: entry.object.scale.clone(),
            }
          : origins?.get(entry.key);
        if (from && (!entry.placed || inHand)) {
          applyPlacement(entry.object, from);
          entry.flight = { from, startedAt: clock };
          entry.placed = true;
        }
      }
      if (pending && trickOrder.includes(pending.key)) pending = null;
      trickOrderShown = new Set(trickOrder);
    },

    update(deltaSeconds) {
      clock += deltaSeconds;
      if (pending && clock - pending.since > CARD_HANDLING.pendingPlaySeconds) {
        console.warn(`[cards] no answer to playing ${pending.key}; back to the hand`);
        pending = null;
      }

      const follow = 1 - Math.exp(-CARD_HANDLING.followSpeed * deltaSeconds);
      for (const entry of cards.values()) {
        const target = targetOf(entry);
        if (!target) {
          entry.object.visible = false;
          entry.placed = false;
          entry.flight = null;
          continue;
        }

        if (suppressed.has(entry.key)) {
          entry.object.visible = false;
          continue;
        }

        if (flyFromHand(entry, target.slot)) {
          entry.object.visible = true;
          entry.outline.visible = false;
          continue;
        }

        const destination =
          entry.drag ?? target.slot.position.clone().addScaledVector(up, target.lift);

        if (!entry.placed) {
          // First appearance: drop in from just above where it belongs.
          entry.object.position.copy(destination).addScaledVector(up, factory.length * 0.5);
          entry.object.quaternion.copy(target.slot.quaternion);
          entry.object.scale.copy(target.slot.scale);
          entry.placed = true;
        }

        entry.object.position.lerp(destination, follow);
        entry.object.quaternion.slerp(target.slot.quaternion, follow);
        entry.object.visible = true;
        entry.outline.visible =
          hovered === entry.key || entry.drag !== null || (leading === entry.key && trickOrder.includes(entry.key));
      }
    },

    handOrder: () => [...handOrder],

    holdForDeal(keys) {
      held = new Set(keys);
      for (const key of keys) {
        const entry = cards.get(key);
        if (!entry) continue;
        entry.raised = false;
        entry.drag = null;
      }
    },

    releaseDealt(key) {
      if (!held.delete(key)) return;
      const entry = cards.get(key);
      const slot = handSlotFor(key);
      if (!entry || !slot) return;
      // Appear exactly where the dealt card came to rest: no drop-in.
      applyPlacement(entry.object, slot);
      entry.placed = true;
      entry.object.visible = true;
    },

    holdTrump(isHeld) {
      trumpHeld = isHeld;
      if (isHeld) trumpSuppressed = false;
      if (trump?.card) trump.object.visible = !isHeld && !trumpSuppressed;
    },

    trickCardObjects() {
      return trickOrder.flatMap((key) => {
        const object = cards.get(key)?.object;
        return object?.visible && !suppressed.has(key) ? [{ key, object }] : [];
      });
    },

    setLeading(key) {
      leading = key;
    },

    trumpCardObject() {
      return trump?.card && trump.object.visible ? trump.object : null;
    },

    suppressTrick(keys) {
      for (const key of keys) {
        suppressed.add(key);
        const object = cards.get(key)?.object;
        if (object) object.visible = false;
      }
    },

    suppressTrump() {
      trumpSuppressed = true;
      if (trump) trump.object.visible = false;
    },

    cardAt(raycaster) {
      const candidates = visibleHand()
        .map((key) => cards.get(key)?.object)
        .filter((object): object is THREE.Object3D => !!object?.visible);
      const hit = raycaster.intersectObjects(candidates, true)[0];
      for (let object: THREE.Object3D | null = hit?.object ?? null; object; object = object.parent) {
        if (typeof object.userData.cardKey === "string") return object.userData.cardKey;
      }
      return null;
    },

    setHovered(key) {
      hovered = key;
    },

    toggleRaised(key) {
      const entry = cards.get(key);
      if (!entry) return;
      const raise = !entry.raised;
      // One card is read at a time.
      for (const other of cards.values()) other.raised = false;
      entry.raised = raise;
    },

    positionOf(key) {
      return cards.get(key)?.object.getWorldPosition(new THREE.Vector3()) ?? null;
    },

    startDrag(key) {
      const entry = cards.get(key);
      if (entry) entry.drag = entry.object.position.clone();
    },

    dragTo(key, world) {
      const entry = cards.get(key);
      if (entry) entry.drag = environment.worldToLocal(world.clone());
    },

    endDrag(key) {
      const entry = cards.get(key);
      if (!entry) return;
      entry.drag = null;
      entry.raised = false;
    },

    handTargets() {
      return visibleHand().flatMap((key) => {
        const slot = handSlotFor(key);
        if (!slot) return [];
        return [{
          key,
          home: environment.localToWorld(slot.position.clone()),
          raised: environment.localToWorld(
            slot.position.clone().addScaledVector(up, liftFor(slot)),
          ),
          playLine: environment.localToWorld(
            slot.position
              .clone()
              .addScaledVector(up, CARD_HANDLING.playLineLengths * factory.length * slot.scale.z),
          ),
        }];
      });
    },

    moveInHand(key, index) {
      const visible = visibleHand();
      const from = visible.indexOf(key);
      if (from === -1) return;
      const to = Math.max(0, Math.min(visible.length - 1, index));
      if (from === to) return;
      visible.splice(from, 1);
      visible.splice(to, 0, key);
      const hidden = handOrder.filter((other) => !visible.includes(other));
      handOrder = [...visible, ...hidden];
    },

    play(key) {
      const entry = cards.get(key);
      if (!entry || pending || !visibleHand().includes(key)) return false;
      if (trickOrder.length >= playedSlots.length) return false;
      entry.drag = null;
      entry.raised = false;
      if (hovered === key) hovered = null;
      pending = { key, since: clock };
      return true;
    },

    cancelPlay() {
      pending = null;
    },

    confirmPlay() {
      if (!pending) return;
      const { key } = pending;
      trickOrder = [...trickOrder, key];
      handOrder = handOrder.filter((other) => other !== key);
      pending = null;
    },

    debugTrump() {
      return {
        visible: trump?.object.visible ?? false,
        card: trump?.card ?? null,
        color: trump?.color ?? null,
      };
    },

    debug() {
      const visible = visibleHand();
      return [...cards.values()].map((entry) => {
        const handIndex = visible.indexOf(entry.key);
        const trickIndex = trickOrder.indexOf(entry.key);
        const place =
          handIndex !== -1
            ? "hand"
            : held.has(entry.key)
              ? "dealing"
              : pending?.key === entry.key
                ? "pending"
                : trickIndex !== -1
                  ? "trick"
                  : "none";
        return {
          key: entry.key,
          place,
          index: place === "hand" ? handIndex : place === "pending" ? trickOrder.length : trickIndex,
          raised: entry.raised,
          dragging: entry.drag !== null,
          outline: entry.outline.visible,
          visible: entry.object.visible,
        };
      });
    },
  };
}
