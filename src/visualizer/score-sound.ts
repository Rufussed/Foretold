import { isEffectsMuted } from "./effects-mute";
import { unlockOnGesture } from "./audio-unlock";
import { SCORE_SOUND } from "./config";

export interface ScoreSound {
  play(): void;
  dispose(): void;
}

// The sound of the tesseract appearing for a trick won. Played through Web
// Audio, like the card sound, so it starts the moment it's asked for.
export function createScoreSound(): ScoreSound {
  let context: AudioContext | null = null;
  let buffer: AudioBuffer | null = null;
  let disposed = false;

  try {
    context = new AudioContext();
    const ctx = context;
    unlockOnGesture(ctx);
    fetch(SCORE_SOUND.url)
      .then((response) => response.arrayBuffer())
      .then((data) => ctx.decodeAudioData(data))
      .then((decoded) => {
        buffer = decoded;
      })
      .catch(() => {
        // Sound is optional: the reward carries on silently.
      });
  } catch {
    context = null;
  }

  return {
    play() {
      const ctx = context;
      if (disposed || isEffectsMuted() || !ctx || !buffer) return;
      // Browsers start a context suspended until the page has been interacted with.
      if (ctx.state === "suspended") void ctx.resume();

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = SCORE_SOUND.volume;
      source.connect(gain).connect(ctx.destination);
      source.start();
    },

    dispose() {
      disposed = true;
      void context?.close();
    },
  };
}
