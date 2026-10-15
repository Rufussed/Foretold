import * as THREE from "three";
import type { Card } from "../../backend/src/game/wizard/models/card";
import type { CardFactory, CardObject } from "./card-objects";
import { CARD_HANDLING } from "./config";
import { blankCardTexture, cardKey, cardTexture } from "./card-textures";
import type { BlindHolder, BlindPlacements } from "./blind-placements";
import { applyPlacement, type Placement } from "./placement";

export type { BlindHolder } from "./blind-placements";

export interface BlindCards {
  // The blind round's cards still held, by holder: a card for one you can see,
  // null for your own, which you can't. Anyone left out holds none; an empty
  // map clears the table of them.
  set(holdings: ReadonlyMap<BlindHolder, Card | null>): void;
  // Hides these holders' cards until each is dealt with releaseDealt; an empty
  // list releases any still held.
  holdForDeal(holders: readonly BlindHolder[]): void;
  releaseDealt(holder: BlindHolder): void;
  // Where a holder's card is held right now, for dealing to it.
  slotFor(holder: BlindHolder): Placement;
  // Where a holder's card actually is, for playing from: your own may have
  // been dragged away from where it's held.
  heldAt(holder: BlindHolder): Placement;
  // Whether a ray hits your own blind card while it's showing.
  localCardAt(raycaster: THREE.Raycaster): boolean;
  // Outlines your card, as the hand's cards are when pointed at.
  setLocalHovered(hovered: boolean): void;
  // Your card's world position, while it's showing.
  localPosition(): THREE.Vector3 | null;
  // Dragging your card: it follows the pointer until it is dropped, then
  // either goes back (endDrag) or stays put while the play is sent (play).
  startDrag(): void;
  dragTo(world: THREE.Vector3): void;
  endDrag(): void;
  play(): void;
  // The play was refused: your card goes back to where it's held.
  cancelPlay(): void;
  // Keeps the cards with the heads and the camera holding them.
  update(): void;
}

interface Held {
  object: CardObject;
  card: string | null;
  holding: boolean;
}

// A blind round's cards (see gameOptions.ts): each player's one card held up
// facing away from them (see blind-placements.ts). The others' cards show you
// their faces; yours shows you its back.
export function createBlindCards(factory: CardFactory, placements: BlindPlacements): BlindCards {
  const held = new Map<BlindHolder, Held>();
  let dealing = new Set<BlindHolder>();
  // Your card, dragged (environment-local position, keeping the held turn) or
  // dropped to be played and waiting for the server (since, in ms).
  let drag: THREE.Vector3 | null = null;
  let dropped: { at: Placement; since: number } | null = null;

  const slotFor = (holder: BlindHolder) => placements.slotFor(holder);

  const targetOf = (holder: BlindHolder): Placement => {
    if (holder !== "local") return slotFor(holder);
    if (dropped) return dropped.at;
    const slot = slotFor(holder);
    return drag ? { ...slot, position: drag.clone() } : slot;
  };

  const refresh = (holder: BlindHolder) => {
    const entry = held.get(holder);
    if (!entry) return;
    if (holder === "local" && !entry.holding) {
      drag = null;
      dropped = null;
    }
    entry.object.object.visible = entry.holding && !dealing.has(holder);
    if (entry.object.object.visible) applyPlacement(entry.object.object, targetOf(holder));
    else entry.object.outline.visible = false;
  };

  const ensure = (holder: BlindHolder): Held => {
    let entry = held.get(holder);
    if (!entry) {
      const object = factory.build(`blind-card-${holder}`, blankCardTexture(), undefined, { unsmoothed: true });
      applyPlacement(object.object, slotFor(holder));
      object.outline.visible = false;
      entry = { object, card: null, holding: false };
      held.set(holder, entry);
    }
    return entry;
  };

  const localObject = () => {
    const object = held.get("local")?.object.object;
    return object?.visible ? object : null;
  };

  return {
    set(holdings) {
      for (const holder of new Set([...held.keys(), ...holdings.keys()])) {
        const card = holdings.get(holder);
        if (card === undefined) {
          const entry = held.get(holder);
          if (entry) entry.holding = false;
          refresh(holder);
          continue;
        }
        const entry = ensure(holder);
        const key = card ? cardKey(card) : null;
        if (entry.card !== key && entry.object.face) {
          entry.object.face.map = card ? cardTexture(card) : blankCardTexture();
        }
        entry.card = key;
        entry.holding = true;
        refresh(holder);
      }
    },

    holdForDeal(holders) {
      dealing = new Set(holders);
      for (const holder of held.keys()) refresh(holder);
    },

    releaseDealt(holder) {
      if (!dealing.delete(holder)) return;
      refresh(holder);
    },

    slotFor,

    heldAt(holder) {
      const object = held.get(holder)?.object.object;
      if (!object?.visible) return slotFor(holder);
      return {
        position: object.position.clone(),
        quaternion: object.quaternion.clone(),
        scale: object.scale.clone(),
      };
    },

    localCardAt(raycaster) {
      const object = localObject();
      return !!object && raycaster.intersectObject(object, true).length > 0;
    },

    setLocalHovered(hovered) {
      const entry = held.get("local");
      if (entry) entry.object.outline.visible = hovered && entry.object.object.visible;
    },

    localPosition() {
      return localObject()?.getWorldPosition(new THREE.Vector3()) ?? null;
    },

    startDrag() {
      const object = localObject();
      if (object && !dropped) drag = object.position.clone();
    },

    dragTo(world) {
      const object = localObject();
      if (object?.parent && drag) drag = object.parent.worldToLocal(world.clone());
    },

    endDrag() {
      drag = null;
    },

    play() {
      const object = localObject();
      drag = null;
      dropped = object
        ? {
            at: { position: object.position.clone(), quaternion: object.quaternion.clone(), scale: object.scale.clone() },
            since: performance.now(),
          }
        : null;
    },

    cancelPlay() {
      dropped = null;
    },

    update() {
      // No answer to a play: back to where it's held, as the hand's cards do.
      if (dropped && performance.now() - dropped.since > CARD_HANDLING.pendingPlaySeconds * 1000) {
        console.warn("[blind] no answer to playing your card; back to your forehead");
        dropped = null;
      }
      for (const [holder, entry] of held) {
        if (entry.object.object.visible) applyPlacement(entry.object.object, targetOf(holder));
      }
    },
  };
}
