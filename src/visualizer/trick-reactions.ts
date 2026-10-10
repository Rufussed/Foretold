import type { PublicWizardGameState } from "../../backend/src/game/wizard/models/wizardGame";
import { isBotName } from "../../backend/src/game/wizard/models/bot";
import { EMOTES } from "./config";
import type { EmoteTrigger } from "./emote-trigger";
import type { Emote, SeatId } from "./player-characters";

const SORE_LOSER: readonly Emote[] = ["disbelief", "disapproval"];
const PLEASED: readonly Emote[] = ["laugh", "thumbsUp"];

// Seats with a reaction waiting out its delay, so the random emoting can leave
// them alone until it has played.
const waiting = new Map<SeatId, number>();
export const reactionPending = (seat: SeatId): boolean => (waiting.get(seat) ?? 0) > 0;

const pick = (emotes: readonly Emote[]) => emotes[Math.floor(Math.random() * emotes.length)];

// How the NPCs take a won trick. An NPC that played in it and lost shows
// disbelief or disapproval; an NPC that won laughs or gives a thumbs up, unless
// the win took it over its prediction, which counts as a loss - and then every
// other NPC laughs or gives a thumbs up instead.
// Everyone else, players' own characters included, is left alone. Requests go
// through the emote trigger like any other, so its cooldowns and blending apply,
// each after its own random wait, between EMOTES.reactionMinSeconds and
// EMOTES.reactionMaxSeconds.
export function reactToTrick(
  state: PublicWizardGameState,
  trigger: EmoteTrigger,
  seatOf: (username: string) => SeatId | null,
): void {
  const winner = state.currentTrick.winnerUsername;
  if (!winner) return;
  const played = new Set(state.currentTrick.playedCards.map((card) => card.username));

  // A win that takes the winner past their prediction counts as a loss: the
  // same test as the red burst, on tricks won that include this one.
  const overPrediction = (username: string) => {
    const player = state.players.find((candidate) => candidate.username === username);
    return !!player && player.prediction !== null && player.tricksWon > player.prediction;
  };

  const winnerLost = overPrediction(winner);

  for (const { username } of state.players) {
    if (!isBotName(username)) continue;
    const seat = seatOf(username);
    if (seat === null) continue;

    let emotes: readonly Emote[] | null;
    if (username === winner) emotes = winnerLost ? SORE_LOSER : PLEASED;
    // The winner overshot their prediction: the other NPCs enjoy it, whether
    // or not they played in the trick.
    else if (winnerLost) emotes = PLEASED;
    else emotes = played.has(username) ? SORE_LOSER : null;
    if (!emotes) continue;
    const emote = pick(emotes);
    // Each at its own moment, so they are not in step.
    const delay = (EMOTES.reactionMinSeconds + Math.random() * (EMOTES.reactionMaxSeconds - EMOTES.reactionMinSeconds)) * 1000;
    waiting.set(seat, (waiting.get(seat) ?? 0) + 1);
    window.setTimeout(() => {
      waiting.set(seat, (waiting.get(seat) ?? 1) - 1);
      trigger.request({ target: seat, emote, source: "ai" });
    }, delay);
  }
}
