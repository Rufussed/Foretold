import * as THREE from "three";
import { ANIMATION, EMOTES } from "./config";

export interface CharacterAnimator {
  readonly mixer: THREE.AnimationMixer;
  // The looping base clip, and the one-shot currently in charge, if any.
  readonly loop: string;
  readonly emote: string | null;
  // Loops a clip as the base animation. A one-shot in progress keeps the pose
  // and hands back to the new loop when it ends.
  playLoop(name: string): void;
  // Plays a clip once, blended in from whatever is showing, then blends back
  // to the loop.
  playOnce(name: string): void;
  actions(): Record<string, THREE.AnimationAction>;
  update(deltaSeconds: number): void;
  dispose(): void;
}

// Idle-and-emote blending for one character, shared by the table seats and the
// corner portrait so both behave identically.
export function createCharacterAnimator(
  root: THREE.Object3D,
  clips: ReadonlyMap<string, THREE.AnimationClip>,
  label: string,
): CharacterAnimator {
  const mixer = new THREE.AnimationMixer(root);
  mixer.timeScale = ANIMATION.timeScale;

  let loopName = "idle";
  let loopAction: THREE.AnimationAction | null = null;
  let onceAction: THREE.AnimationAction | null = null;

  const actionFor = (name: string) => {
    const clip = clips.get(name);
    if (!clip) {
      console.warn(`[animation] ${label} has no "${name}" clip`);
      return null;
    }
    return mixer.clipAction(clip);
  };

  const onFinished = ({ action }: { action: THREE.AnimationAction }) => {
    // A superseded one-shot can still reach its end while fading out; only
    // the one currently in charge may hand back to the loop.
    if (action !== onceAction) return;
    onceAction = null;
    const loop = loopAction;
    if (!loop) return;
    loop.enabled = true;
    loop.play();
    action.crossFadeTo(loop, EMOTES.crossfadeSeconds, false);
  };
  mixer.addEventListener("finished", onFinished);

  return {
    mixer,

    get loop() {
      return loopName;
    },

    get emote() {
      return onceAction?.getClip().name ?? null;
    },

    playLoop(name) {
      loopName = name;
      const next = actionFor(name);
      const previous = loopAction;
      if (!next || next === previous) return;

      if (next === onceAction) {
        // The clip is already on screen as a one-shot: keep it playing and let
        // it carry on as the loop, rather than restarting it.
        onceAction = null;
        next.setLoop(THREE.LoopRepeat, Infinity);
        next.clampWhenFinished = false;
        next.paused = false;
        previous?.stop();
        loopAction = next;
        return;
      }

      next.reset();
      next.setLoop(THREE.LoopRepeat, Infinity);
      // Random phase stops several characters swaying in lockstep.
      next.time = Math.random() * next.getClip().duration;
      loopAction = next;

      if (onceAction) {
        // A one-shot owns the pose; the new loop is faded in when it finishes.
        previous?.stop();
        return;
      }
      next.play();
      if (previous) previous.crossFadeTo(next, EMOTES.crossfadeSeconds, false);
    },

    playOnce(name) {
      const next = actionFor(name);
      if (!next) return;

      if (next === loopAction) {
        // This clip is the looping one: restart the loop instead of turning it
        // into a one-shot, which would stop it ever looping again.
        const playing = onceAction;
        onceAction = null;
        next.reset();
        next.setLoop(THREE.LoopRepeat, Infinity);
        next.play();
        if (playing) playing.crossFadeTo(next, EMOTES.crossfadeSeconds, false);
        return;
      }

      const from = onceAction ?? loopAction;
      next.reset();
      next.setLoop(THREE.LoopOnce, 1);
      next.clampWhenFinished = true;
      next.play();
      if (from && from !== next) from.crossFadeTo(next, EMOTES.crossfadeSeconds, false);
      onceAction = next;
    },

    actions() {
      const actions: Record<string, THREE.AnimationAction> = {};
      for (const [name, clip] of clips) {
        const action = mixer.existingAction(clip);
        if (action) actions[name] = action;
      }
      return actions;
    },

    update(deltaSeconds) {
      mixer.update(deltaSeconds);
    },

    dispose() {
      mixer.removeEventListener("finished", onFinished);
      mixer.stopAllAction();
      mixer.uncacheRoot(root);
    },
  };
}
