import type { PublicWizardGameState } from "../../backend/src/game/wizard/models/wizardGame";
import { OPPONENT_PLAYS, PORTRAIT_CAMERA } from "./config";
import { isTouchDevice } from "./device-limits";
import { paced } from "./pace";

// Camera behaviour for portrait screens only. The window is narrow there, so
// the camera turned toward a player cannot also show the cards in play: while
// a card moves to them, the camera comes back to the middle first.

export const isPortraitView = (): boolean => window.matchMedia("(orientation: portrait)").matches;

// What the table director asks for: how the camera centres on a card being
// played, or null outside portrait, where the turn already shows the table.
export const centreForPlays = (): { panSeconds: number; holdSeconds: number } | null =>
  isPortraitView()
    ? {
        // The card's flight is up out of the hand, then across; the pan takes a
        // little longer, so it settles just behind the card.
        panSeconds:
          (OPPONENT_PLAYS.liftSeconds + OPPONENT_PLAYS.travelSeconds) * PORTRAIT_CAMERA.centrePanLength,
        holdSeconds: PORTRAIT_CAMERA.centreHoldSeconds,
      }
    : null;

export interface BlindTour {
  // Starts the tour if this is a blind round's prediction, on your turn, in
  // portrait or on a touch screen; otherwise does nothing.
  start(state: PublicWizardGameState): void;
  // Ends it (the prediction is made, or the turn ran out).
  stop(): void;
}

// In a blind round you predict without seeing your own cards, only everyone
// else's - and a portrait screen shows only the part of the table the camera
// faces, while on a phone held landscape the HUD covers the two nearest
// players. So until you have predicted the camera looks at each other player in
// turn, in play order, a second on each, and starts the round again.
export function createBlindTour(
  localUsername: string,
  lookAt: (username: string | null, done: () => void) => void,
): BlindTour {
  let run = 0;

  const sleep = (seconds: number) =>
    new Promise<void>((resolve) => window.setTimeout(resolve, paced(seconds) * 1000));
  const turnTo = (username: string) =>
    new Promise<void>((resolve) => lookAt(username, resolve));

  return {
    start(state) {
      const current = state.players[state.currentPlayerIndex]?.username;
      if (!(isPortraitView() || isTouchDevice()) || !state.blindRound || state.phase !== "predictions") return;
      if (current !== localUsername) return;

      // Play order from the player after you, all the way round.
      const me = state.players.findIndex((player) => player.username === localUsername);
      const others = state.players
        .map((_, offset) => state.players[(me + 1 + offset) % state.players.length]!)
        .filter((player) => player.username !== localUsername)
        .map((player) => player.username);
      if (!others.length) return;

      const id = ++run;
      void (async () => {
        while (run === id) {
          for (const username of others) {
            if (run !== id) return;
            await turnTo(username);
            if (run !== id) return;
            await sleep(PORTRAIT_CAMERA.tourDwellSeconds);
          }
        }
      })();
    },

    stop() {
      run++;
    },
  };
}
