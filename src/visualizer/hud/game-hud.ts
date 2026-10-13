import type { GameConnection } from "../game-connection";
import { createAnnouncer, type AnnouncerOptions } from "./announcer";
import type { PublicWizardGameState } from "../../../backend/src/game/wizard/models/wizardGame";
import { followSuitMessage, trumpMessage } from "./announcements";
import { createGameStatusPanel } from "./game-status-panel";
import type { HudPart } from "./hud-part";
import { createPlayerList } from "./player-list";

// The trump colour stays up this much longer than other messages, at any speed.
const TRUMP_EXTRA_SECONDS = 1;

export interface GameHudOptions extends AnnouncerOptions {
  // The round the card table is showing; see player-list.ts.
  tableRound?(): number | undefined;
}

export interface GameHud extends HudPart {
  // Redraw the player list alone, as the table starts a round's deal.
  refreshPlayers(): void;
  // The server refused a move, with its reason.
  refused(error: string): void;
  // Calls done once every announcement has had its time.
  whenIdle(done: () => void): void;
  // Which suit is trumps, said once the round's cards are dealt.
  announceTrump(state: PublicWizardGameState): void;
}

// The in-game overlay: what's going on (top centre), the game status and
// scores (top right) and every player's round, yours included (bottom left).
export function createGameHud(
  root: HTMLElement,
  game: GameConnection,
  options: GameHudOptions = {},
): GameHud {
  const statusPanel = createGameStatusPanel(root, game);
  // After the panel, so a round's scores are held back before it redraws.
  const announcer = createAnnouncer(root, game, statusPanel, options);
  const playerList = createPlayerList(root, game, options);
  const parts = [statusPanel, announcer, playerList];

  return {
    applyState: () => parts.forEach((part) => part.applyState()),
    dispose: () => parts.forEach((part) => part.dispose()),
    refreshPlayers: () => playerList.applyState(),
    whenIdle: (done) => announcer.whenIdle(done),
    announceTrump(state) {
      const text = trumpMessage(state);
      if (text) announcer.announce(text, TRUMP_EXTRA_SECONDS, state.trumpSuit ?? undefined);
    },
    refused(error) {
      const state = game.state();
      // The server's words for a card that doesn't follow suit.
      if (state && error === "Card cannot be played") announcer.notice(followSuitMessage(state));
    },
  };
}
