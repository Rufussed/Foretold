import type { GameConnection } from "../game-connection";
import { createAnnouncer, type AnnouncerOptions } from "./announcer";
import { followSuitMessage } from "./announcements";
import { createGameStatusPanel } from "./game-status-panel";
import type { HudPart } from "./hud-part";
import { createOpponentGrid } from "./opponent-grid";
import { createSelfRoundStats } from "./self-round-stats";

export interface GameHud extends HudPart {
  // The server refused a move, with its reason.
  refused(error: string): void;
  // Calls done once every announcement has had its time.
  whenIdle(done: () => void): void;
}

// The in-game overlay: what's going on (top centre), the game status and
// scores (top right), your round (bottom right) and the other players' round
// (bottom left).
export function createGameHud(
  root: HTMLElement,
  game: GameConnection,
  options: AnnouncerOptions = {},
): GameHud {
  const statusPanel = createGameStatusPanel(root, game);
  // After the panel, so a round's scores are held back before it redraws.
  const announcer = createAnnouncer(root, game, statusPanel, options);
  const parts = [statusPanel, announcer, createSelfRoundStats(root, game), createOpponentGrid(root, game)];

  return {
    applyState: () => parts.forEach((part) => part.applyState()),
    dispose: () => parts.forEach((part) => part.dispose()),
    whenIdle: (done) => announcer.whenIdle(done),
    refused(error) {
      const state = game.state();
      // The server's words for a card that doesn't follow suit.
      if (state && error === "Card cannot be played") announcer.notice(followSuitMessage(state));
    },
  };
}
