import { CHIME_SOUND } from "./config";
import { isEffectsMuted } from "./effects-mute";
import { unlockOnGesture } from "./audio-unlock";

export type ChimeOutcome = "win" | "lose";

export interface ChimeSound {
  play(outcome: ChimeOutcome): void;
  dispose(): void;
}

// The chime that goes with a trick's burst of rays: bright for a winner still
// on course for their prediction, a falling one when they have won more tricks
// than they predicted. Played through Web Audio, like the card sound.
export function createChimeSound(): ChimeSound {
  let context: AudioContext | null = null;
  const buffers: Partial<Record<ChimeOutcome, AudioBuffer>> = {};
  let disposed = false;

  try {
    context = new AudioContext();
    const ctx = context;
    unlockOnGesture(ctx);
    const load = (outcome: ChimeOutcome, url: string) =>
      fetch(url)
        .then((response) => response.arrayBuffer())
        .then((data) => ctx.decodeAudioData(data))
        .then((decoded) => {
          buffers[outcome] = decoded;
        })
        .catch(() => {
          // Sound is optional: the burst carries on silently.
        });
    void load("win", CHIME_SOUND.winUrl);
    void load("lose", CHIME_SOUND.loseUrl);
  } catch {
    context = null;
  }

  return {
    play(outcome) {
      const ctx = context;
      const buffer = buffers[outcome];
      if (disposed || isEffectsMuted() || !ctx || !buffer) return;
      if (ctx.state === "suspended") void ctx.resume();

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = CHIME_SOUND.volume;
      source.connect(gain).connect(ctx.destination);
      source.start();
    },

    dispose() {
      disposed = true;
      void context?.close();
    },
  };
}
