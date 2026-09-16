import * as THREE from "three";
import type { CardFactory, CardObject } from "./card-objects";
import { blankCardTexture } from "./card-textures";
import { DEALING } from "./config";
import { applyPlacement, type Placement } from "./placement";
import type { TableLayout } from "./table-layout";

export interface DealStep {
  target: Placement;
  // The face the card shows once it lands; null for one this player can't see.
  face: THREE.Texture | null;
  onLanded(): void;
}

export interface CardDeal {
  // Gathers every card back into a full, face-down stack.
  reset(): void;
  // The stack with its top cards already dealt, for a round joined partway.
  settle(dealt: number): void;
  // Deals from the top of the stack, one card after another; onDone runs once
  // the last card has landed.
  deal(steps: readonly DealStep[], onDone?: () => void): void;
  readonly dealing: boolean;
  update(deltaSeconds: number): void;
  // Development aid.
  debug(): { onStack: number; flying: number; queued: number };
}

interface Flight {
  card: CardObject;
  from: Placement;
  step: DealStep;
  startAt: number;
}

const smooth = (x: number) => {
  const t = Math.min(Math.max(x, 0), 1);
  return t * t * (3 - 2 * t);
};

// The card stack at the table's centre, and dealing from it. Each card rises
// straight up off the top staying flat, travels flat to above where it's
// going, then turns into place as it settles. The next card leaves the stack
// DEALING.intervalSeconds after the one before.
export function createCardDeal(factory: CardFactory, layout: TableLayout): CardDeal {
  // The stack targets hold their cards face up; turn each over about its long
  // axis so the stack lies face down.
  const faceDown = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI);
  const slots: Placement[] = layout.stack.map((slot) => ({
    position: slot.position.clone(),
    quaternion: slot.quaternion.clone().multiply(faceDown),
    scale: slot.scale.clone(),
  }));
  const stackTop = slots.reduce((top, slot) => Math.max(top, slot.position.y), 0);
  const stack = slots.map((_, index) =>
    factory.build(`stack-card-object-${index + 1}`, blankCardTexture()),
  );

  let top = -1; // index of the top card still on the stack
  let queue: DealStep[] = [];
  let flights: Flight[] = [];
  let onDone: (() => void) | null = null;
  let clock = 0;
  let nextLaunch = 0;

  const gather = (dealt: number) => {
    queue = [];
    flights = [];
    onDone = null;
    top = slots.length - 1 - Math.max(0, dealt);
    stack.forEach((card, index) => {
      applyPlacement(card.object, slots[index]);
      if (card.face) card.face.map = blankCardTexture();
      card.object.visible = index <= top;
    });
  };
  gather(0);

  const animate = (flight: Flight): boolean => {
    const { card, from, step } = flight;
    const lift = Math.max(DEALING.liftSeconds, 1e-6);
    const travel = Math.max(DEALING.travelSeconds, 1e-6);
    const settle = Math.max(DEALING.settleSeconds, 1e-6);
    const t = clock - flight.startAt;

    if (t >= lift + travel + settle) {
      card.object.visible = false;
      step.onLanded();
      return false;
    }

    const cruise = Math.max(stackTop, step.target.position.y) + DEALING.liftHeight;
    const above = from.position.clone().setY(cruise);
    const over = step.target.position.clone().setY(cruise);

    if (t < lift) {
      card.object.position.lerpVectors(from.position, above, smooth(t / lift));
      card.object.quaternion.copy(from.quaternion);
    } else if (t < lift + travel) {
      card.object.position.lerpVectors(above, over, smooth((t - lift) / travel));
      card.object.quaternion.copy(from.quaternion);
    } else {
      const k = smooth((t - lift - travel) / settle);
      card.object.position.lerpVectors(over, step.target.position, k);
      card.object.quaternion.slerpQuaternions(from.quaternion, step.target.quaternion, k);
    }
    card.object.scale.copy(step.target.scale);
    return true;
  };

  return {
    reset: () => gather(0),
    settle: (dealt) => gather(dealt),

    deal(steps, done) {
      queue = [...steps];
      onDone = done ?? null;
      nextLaunch = clock;
    },

    get dealing() {
      return queue.length > 0 || flights.length > 0;
    },

    update(deltaSeconds) {
      clock += deltaSeconds;

      while (queue.length && nextLaunch <= clock) {
        const step = queue.shift()!;
        if (top < 0) {
          // The stack ran out: let the card count as arrived anyway.
          step.onLanded();
          continue;
        }
        const card = stack[top];
        const from = slots[top];
        top -= 1;
        if (card.face) card.face.map = step.face ?? blankCardTexture();
        flights.push({ card, from, step, startAt: nextLaunch });
        nextLaunch += DEALING.intervalSeconds;
      }

      flights = flights.filter(animate);

      if (onDone && !queue.length && !flights.length) {
        const done = onDone;
        onDone = null;
        done();
      }
    },

    debug: () => ({ onStack: top + 1, flying: flights.length, queued: queue.length }),
  };
}
