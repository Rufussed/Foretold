import { OPPONENT_PLAYS, PORTRAIT_CAMERA } from "./config";

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
