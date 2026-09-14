import * as THREE from "three";
import type { Card, Suit } from "../../backend/src/game/wizard/models/card";
import type { CardFactory } from "./card-objects";
import { cardKey, cardTexture, trumpColor, trumpFaceTexture } from "./card-textures";
import { CARD_HANDLING } from "./config";
import { applyPlacement, type Placement } from "./placement";
import type { TableLayout } from "./table-layout";

export interface HandTarget {
  key: string;
  home: THREE.Vector3; // world position in its hand slot
  raised: THREE.Vector3; // world position when raised to be read
}

export interface TableCards {
  // Your hand, from game state. The order you've arranged cards still in hand
  // is kept; new cards join at the end, so a fresh deal arrives in server order.
  setHand(cards: readonly Card[]): void;
  // Cards played in the current trick, in play order.
  setTrick(cards: readonly Card[]): void;
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
}

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
  let held = new Set<string>();
  let trumpHeld = false;
  let clock = 0;
  let warnedOverflow = false;

  const ensure = (card: Card): TableCard => {
    const key = cardKey(card);
    const existing = cards.get(key);
    if (existing) return existing;

    const { object, outline } = factory.build(`table-card-${key}`, cardTexture(card));
    object.userData.cardKey = key;
    const entry: TableCard = { key, object, outline, raised: false, drag: null, placed: false };
    cards.set(key, entry);
    return entry;
  };

  let trump: {
    object: THREE.Object3D;
    face: THREE.MeshStandardMaterial | null;
    card: string | null;
    color: string | null;
  } | null = null;

  const visibleHand = () => handOrder.filter((key) => key !== pending?.key && !held.has(key));

  const targetOf = (entry: TableCard): { slot: Placement; lift: number } | null => {
    const handIndex = visibleHand().indexOf(entry.key);
    if (handIndex !== -1) {
      const slot = handSlots[handIndex];
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
      trump.object.visible = !trumpHeld;
      trump.card = cardKey(card);
      trump.color = trumpColor(trumpSuit);
    },

    setTrick(cardsPlayed) {
      trickOrder = cardsPlayed.map(cardKey);
      for (const card of cardsPlayed) ensure(card);
      if (pending && trickOrder.includes(pending.key)) pending = null;
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
        entry.outline.visible = hovered === entry.key || entry.drag !== null;
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
      const slot = handSlots[visibleHand().indexOf(key)];
      if (!entry || !slot) return;
      // Appear exactly where the dealt card came to rest: no drop-in.
      applyPlacement(entry.object, slot);
      entry.placed = true;
      entry.object.visible = true;
    },

    holdTrump(isHeld) {
      trumpHeld = isHeld;
      if (trump?.card) trump.object.visible = !isHeld;
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
      return visibleHand()
        .slice(0, handSlots.length)
        .map((key, index) => {
          const slot = handSlots[index];
          return {
            key,
            home: environment.localToWorld(slot.position.clone()),
            raised: environment.localToWorld(
              slot.position.clone().addScaledVector(up, liftFor(slot)),
            ),
          };
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
