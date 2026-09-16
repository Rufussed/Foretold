import { EMOTES } from "./config";
import type { EmoteTrigger } from "./emote-trigger";
import { EMOTE_NAMES, type SeatId } from "./player-characters";

// Placeholder for AI players deciding to emote. At random intervals one of the
// candidate seats plays a random emote, requested through the trigger exactly
// as a real decision would be, so cooldowns and blending apply.
export function createAiEmotes(
  trigger: EmoteTrigger,
  candidates: () => readonly SeatId[],
): { update(deltaSeconds: number): void } {
  const nextWait = () =>
    EMOTES.aiMinSeconds + Math.random() * (EMOTES.aiMaxSeconds - EMOTES.aiMinSeconds);
  let wait = nextWait();

  return {
    update(deltaSeconds) {
      if (!EMOTES.aiEnabled) return;
      wait -= deltaSeconds;
      if (wait > 0) return;
      wait = nextWait();

      const seats = candidates();
      if (!seats.length) return;
      const seat = seats[Math.floor(Math.random() * seats.length)];
      const emote = EMOTE_NAMES[Math.floor(Math.random() * EMOTE_NAMES.length)];
      trigger.request({ target: seat, emote, source: "ai" });
    },
  };
}
