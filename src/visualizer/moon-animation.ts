import * as THREE from "three";
import { MOON } from "./config";

// Starts a clip's action, stretching the moon's arc to MOON.durationSeconds.
export function playClip(
  mixer: THREE.AnimationMixer,
  clip: THREE.AnimationClip,
): THREE.AnimationAction {
  const action = mixer.clipAction(clip);
  if (clip.name === MOON.clipName && MOON.durationSeconds > 0) {
    action.setDuration(MOON.durationSeconds);
    // At the end it jumps straight back to the start and goes round again.
    action.setLoop(THREE.LoopRepeat, Infinity);
  }
  return action.play();
}
