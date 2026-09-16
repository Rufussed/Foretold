import { EMOTES } from "./config";
import type { Emote, PlayerCharacters, SeatId } from "./player-characters";

export type TriggerSource = "local" | "ai" | "network";

// "self" is the local player's own character in the corner portrait. It has
// no table seat, so targets are wider than SeatId.
export type EmoteTarget = SeatId | "self";

export interface EmoteRequest {
  target: EmoteTarget;
  emote: Emote;
  source: TriggerSource;
}

export interface EmoteTrigger {
  request(request: EmoteRequest): void;
  update(deltaSeconds: number): void;
}

// The single gate for emotes. Players press a button, AI players decide, and
// later other clients relay theirs: all arrive here as requests, never derived
// from game state. Interrupting an emote is already safe in PlayerCharacters,
// which crossfades and ignores the superseded clip's finish, so the cooldown is
// only there to stop repeated presses reading as a stutter.
export function createEmoteTrigger(
  characters: PlayerCharacters,
  onSelfEmote?: (emote: Emote) => void,
): EmoteTrigger {
  // Advanced by update(), so cooldowns follow the render loop and pause with it.
  let clock = 0;
  const targets = new Map<EmoteTarget, { readyAt: number; queued: Emote | null }>();

  const play = (
    target: EmoteTarget,
    emote: Emote,
    state: { readyAt: number; queued: Emote | null },
  ) => {
    state.readyAt = clock + EMOTES.cooldownSeconds;
    state.queued = null;

    if (target === "self") {
      onSelfEmote?.(emote);
      return;
    }

    characters.emote(target, emote);
  };

  return {
    request({ target, emote }) {
      let state = targets.get(target);
      if (!state) {
        state = { readyAt: 0, queued: null };
        targets.set(target, state);
      }

      if (clock >= state.readyAt) {
        play(target, emote, state);
      } else if (EMOTES.onCooldownHit === "queue") {
        // One slot per character: the newest press replaces an older one.
        state.queued = emote;
      }
    },

    update(deltaSeconds) {
      clock += deltaSeconds;
      for (const [target, state] of targets) {
        if (state.queued && clock >= state.readyAt) {
          play(target, state.queued, state);
        }
      }
    },
  };
}
