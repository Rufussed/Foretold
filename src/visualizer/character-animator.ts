import * as THREE from "three";
import { ANIMATION, EMOTES } from "./config";

export interface SeamlessLoopOptions {
  // Seconds into the clip where the loop begins (past the ease-in).
  start: number;
  // Seconds before the clip's end where the loop is cut (before the ease-out).
  trim: number;
  // Seconds the end of the loop takes to blend into its start.
  fade: number;
}

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
  // Loops a clip as the base animation without ever returning to its first or
  // last frames: it plays from the start once, then loops only the part from
  // `start` to `trim` before the end, blending the end of that part into its
  // start. For a clip authored to ease out of and back into idle at its ends.
  playSeamlessLoop(name: string, options: SeamlessLoopOptions): void;
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
  // A loop that blends its own end into its start, between two copies of the
  // same clip taking turns (see playSeamlessLoop).
  let seamless: { other: THREE.AnimationAction; options: SeamlessLoopOptions; duration: number } | null = null;

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
      seamless = null;
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

    playSeamlessLoop(name, options) {
      const clip = clips.get(name);
      if (!clip) {
        console.warn(`[animation] ${label} has no "${name}" clip`);
        return;
      }
      loopName = name;
      const first = mixer.clipAction(clip);
      // A second copy of the clip, so the next lap can start while this one
      // fades out; one clip cannot be at two times at once.
      const copy = clip.clone();
      copy.name = `${name}~next`;
      const second = mixer.clipAction(copy);

      const from = onceAction ?? loopAction;
      onceAction = null;
      first.reset();
      first.setLoop(THREE.LoopOnce, 1);
      first.clampWhenFinished = true;
      first.play();
      if (from && from !== first) from.crossFadeTo(first, EMOTES.crossfadeSeconds, false);
      loopAction = first;
      seamless = { other: second, options, duration: clip.duration };
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
      // Near the loop's end the next lap starts, from the loop's start, and
      // this one fades into it; they then swap roles for the lap after.
      const current = loopAction;
      if (seamless && current && current.time >= seamless.duration - seamless.options.trim) {
        const next = seamless.other;
        next.reset();
        next.setLoop(THREE.LoopOnce, 1);
        next.clampWhenFinished = true;
        next.time = seamless.options.start;
        next.play();
        current.crossFadeTo(next, seamless.options.fade, false);
        loopAction = next;
        seamless.other = current;
      }
    },

    dispose() {
      mixer.removeEventListener("finished", onFinished);
      mixer.stopAllAction();
      mixer.uncacheRoot(root);
    },
  };
}
