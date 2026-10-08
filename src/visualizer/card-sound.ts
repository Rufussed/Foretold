import { isEffectsMuted } from "./effects-mute";
import { unlockOnGesture } from "./audio-unlock";
import { CARD_SOUND } from "./config";

export interface CardSound {
  // One of the deal sounds at random, at a slightly random speed and pitch.
  play(): void;
  dispose(): void;
}

// The sound of a card leaving the stack. Played through Web Audio so each
// play can change its playback rate, which shifts speed and pitch together.
export function createCardSound(): CardSound {
  let context: AudioContext | null = null;
  let buffers: AudioBuffer[] = [];
  let disposed = false;

  try {
    context = new AudioContext();
    const ctx = context;
    unlockOnGesture(ctx);
    Promise.all(
      CARD_SOUND.urls.map(async (url) => {
        const response = await fetch(url);
        return ctx.decodeAudioData(await response.arrayBuffer());
      }),
    )
      .then((decoded) => {
        buffers = decoded;
      })
      .catch(() => {
        // Sound is optional: dealing carries on silently.
      });
  } catch {
    context = null;
  }

  return {
    play() {
      const ctx = context;
      if (disposed || isEffectsMuted() || !ctx || !buffers.length) return;
      // Browsers start a context suspended until the page has been interacted with.
      if (ctx.state === "suspended") void ctx.resume();

      const source = ctx.createBufferSource();
      source.buffer = buffers[Math.floor(Math.random() * buffers.length)];
      source.playbackRate.value = 1 + (Math.random() * 2 - 1) * CARD_SOUND.rateVariation;
      const gain = ctx.createGain();
      gain.gain.value = CARD_SOUND.volume;
      source.connect(gain).connect(ctx.destination);
      source.start();
    },

    dispose() {
      disposed = true;
      void context?.close();
    },
  };
}
