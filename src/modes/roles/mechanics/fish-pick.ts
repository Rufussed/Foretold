import type { PublicWizardGameState } from "../../../../backend/src/game/wizard/models/wizardGame";
import { fishingSpots } from "../../../../backend/src/game/wizard/modes/roles/fisher";
import { playerOf } from "../../../../backend/src/game/wizard/modes/roles/rolePlay";
import { cardKey } from "../../../visualizer/card-textures";
import { canAct, isLocalTurn, type GameConnection } from "../../../visualizer/game-connection";
import type { TrickPick } from "./trick-pick";
import { t } from "../../../i18n";

// Roles mode only. A Fisher's catch, picked on the table (trick-pick.ts):
// once the trick is complete and it is your turn to fish, the cards you may
// fish rise, the banner says to click one, and the one clicked is sent as
// `fish_card` once the cards have settled.

export interface FishPick {
  // Call after every game-state update: raises the cards to pick, or sets
  // them down.
  applyState(): void;
  // The server refused the catch: the cards rise again to pick another.
  refused(): void;
  dispose(): void;
}

export interface FishPickOptions {
  pick: TrickPick;
  game: GameConnection;
  // While true nothing rises, e.g. until your turn is shown.
  blocked?(): boolean;
}

// The cards the local Fisher may fish: their places in the trick, by card key.
function spotsFor(state: PublicWizardGameState, local: string): Map<string, number> {
  const playedCards = state.currentTrick.playedCards;
  const three = playedCards.findIndex((played) => playerOf(played) === local);
  return new Map(fishingSpots(playedCards, three).map((spot) => [cardKey(playedCards[spot]!.card), spot]));
}

export function createFishPick({ pick, game, blocked }: FishPickOptions): FishPick {
  // The cards up, and a catch on its way: nothing rises again until it is
  // answered.
  let raisedFor = "";
  let sending = false;

  const applyState = () => {
    const state = game.state();
    const open = state?.phase === "fishing" && canAct(game) && isLocalTurn(game) && !blocked?.();
    if (!state || !open) {
      sending = false;
      if (raisedFor) pick.clear();
      raisedFor = "";
      return;
    }
    if (sending) return;
    const spots = spotsFor(state, game.localUsername);
    const keys = [...spots.keys()];
    if (keys.join() === raisedFor) return;
    raisedFor = keys.join();
    pick.raise(keys, t("pick.fish"), (key) => {
      const spot = spots.get(key);
      raisedFor = "";
      sending = spot !== undefined && game.send({ type: "fish_card", spot });
    });
  };

  return {
    applyState,

    refused() {
      if (!sending) return;
      sending = false;
      applyState();
    },

    dispose() {
      if (raisedFor) pick.clear();
    },
  };
}
