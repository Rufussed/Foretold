import * as THREE from "three";
import { TRICK_REWARD } from "./config";
import { createTesseract, loadTesseract, type Tesseract, type TesseractModel } from "./tesseract";

export type RewardDestination =
  | { kind: "head"; head(): THREE.Vector3 | null }
  | { kind: "camera"; camera: THREE.Camera };

export interface RewardPlan {
  // Card objects to gather. They're copied, so the originals can be hidden or
  // reused straight away.
  cards: readonly THREE.Object3D[];
  // Where the cards shrink to and the tesseract appears, in world space.
  point: THREE.Vector3;
  // Who receives the tesseract; null just gathers the cards.
  destination: RewardDestination | null;
  // Tints the tesseract; null keeps its own colour.
  color: string | null;
}

export interface TrickRewards {
  play(plan: RewardPlan): void;
  update(deltaSeconds: number): void;
  // Development aid: every reward in progress.
  debug(): Array<{ phase: string; elapsed: number; scale: number; position: number[] | null }>;
}

interface Gathered {
  copy: THREE.Object3D;
  from: THREE.Vector3;
  fromScale: THREE.Vector3;
}

interface Reward {
  plan: RewardPlan;
  gathered: Gathered[];
  tesseract: Tesseract | null;
  elapsed: number;
  lastHead: THREE.Vector3 | null;
  phase: string;
  scale: number;
}

const clamp01 = (t: number) => Math.min(Math.max(t, 0), 1);
const easeInOut = (t: number) => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
};
const easeIn = (t: number) => clamp01(t) ** 3;

// The reward for winning a trick. The cards in play shrink into a point, a
// tesseract grows there to TRICK_REWARD.startScale, floats to just above the
// winner's head, swells to peakScale, then dives down into their head as it
// shrinks away. For your own wins it hovers in front of the camera and dives
// into it.
export function createTrickRewards(environment: THREE.Object3D): TrickRewards {
  const rewards: Reward[] = [];
  let model: TesseractModel | null = null;
  loadTesseract()
    .then((loaded) => {
      model = loaded;
    })
    .catch((error) => console.warn("[rewards] the tesseract model didn't load:", error));

  const toLocal = (world: THREE.Vector3) => environment.worldToLocal(world.clone());

  // Where it hovers and where it dives to, in environment space.
  const destinationPoints = (reward: Reward) => {
    const destination = reward.plan.destination!;
    if (destination.kind === "head") {
      const head = destination.head() ?? reward.lastHead ?? reward.plan.point;
      reward.lastHead = head.clone();
      const into = toLocal(head);
      return { hover: into.clone().add(new THREE.Vector3(0, TRICK_REWARD.aboveHead, 0)), into };
    }
    const eye = destination.camera.getWorldPosition(new THREE.Vector3());
    const forward = destination.camera.getWorldDirection(new THREE.Vector3());
    return {
      hover: toLocal(eye.clone().addScaledVector(forward, TRICK_REWARD.cameraDistance)),
      into: toLocal(eye.clone().addScaledVector(forward, 0.2)),
    };
  };

  return {
    play(plan) {
      const gathered = plan.cards.map((card) => {
        const copy = card.clone(true);
        copy.visible = true;
        copy.traverse((child) => {
          if (child.name === "card-outline") child.visible = false;
        });
        environment.add(copy);
        return { copy, from: copy.position.clone(), fromScale: copy.scale.clone() };
      });
      rewards.push({ plan, gathered, tesseract: null, elapsed: 0, lastHead: null, phase: "gather", scale: 0 });
    },

    update(deltaSeconds) {
      const gather = TRICK_REWARD.gatherSeconds;
      const grow = TRICK_REWARD.growSeconds;
      const float = TRICK_REWARD.floatSeconds;
      const swell = TRICK_REWARD.swellSeconds;
      const dive = TRICK_REWARD.diveSeconds;
      const startScale = TRICK_REWARD.startScale;
      const peakScale = TRICK_REWARD.peakScale;

      for (let index = rewards.length - 1; index >= 0; index--) {
        const reward = rewards[index];
        reward.elapsed += deltaSeconds;
        const t = reward.elapsed;
        const point = toLocal(reward.plan.point);

        // The cards shrink into the point.
        if (reward.gathered.length) {
          const k = easeInOut(t / Math.max(gather, 1e-6));
          for (const item of reward.gathered) {
            item.copy.position.lerpVectors(item.from, point, k);
            item.copy.scale.copy(item.fromScale).multiplyScalar(Math.max(1 - k, 1e-6));
          }
          if (t >= gather) {
            for (const item of reward.gathered) item.copy.removeFromParent();
            reward.gathered = [];
          }
        }

        if (!reward.plan.destination) {
          if (t >= gather) rewards.splice(index, 1);
          continue;
        }
        if (t < gather) continue;

        if (!reward.tesseract) {
          if (!model) {
            // Still loading; give up rather than wait forever.
            if (t > gather + 5) rewards.splice(index, 1);
            continue;
          }
          reward.tesseract = createTesseract(model, environment);
          reward.tesseract.setColor(reward.plan.color);
        }

        const tesseract = reward.tesseract;
        tesseract.update(deltaSeconds);
        const since = t - gather;
        const { hover, into } = destinationPoints(reward);
        let position: THREE.Vector3;
        let scale: number;

        if (since < grow) {
          reward.phase = "grow";
          position = point;
          scale = startScale * easeInOut(since / grow);
        } else if (since < grow + float) {
          reward.phase = "float";
          position = point.clone().lerp(hover, easeInOut((since - grow) / float));
          scale = startScale;
        } else if (since < grow + float + swell) {
          reward.phase = "swell";
          position = hover;
          scale = startScale + (peakScale - startScale) * easeInOut((since - grow - float) / swell);
        } else if (since < grow + float + swell + dive) {
          reward.phase = "dive";
          const k = easeIn((since - grow - float - swell) / dive);
          position = hover.clone().lerp(into, k);
          scale = peakScale * (1 - k);
        } else {
          tesseract.dispose();
          rewards.splice(index, 1);
          continue;
        }

        tesseract.object.position.copy(position);
        tesseract.setScale(scale);
        reward.scale = scale;
      }
    },

    debug() {
      return rewards.map((reward) => ({
        phase: reward.phase,
        elapsed: +reward.elapsed.toFixed(3),
        scale: +reward.scale.toFixed(3),
        position: reward.tesseract ? reward.tesseract.object.position.toArray().map((n) => +n.toFixed(3)) : null,
      }));
    },
  };
}
