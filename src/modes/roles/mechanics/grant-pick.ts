import { cardKey } from "../../../visualizer/card-textures";
import { canAct, isLocalTurn, type GameConnection } from "../../../visualizer/game-connection";
import type { TrickPick } from "./trick-pick";
import { t } from "../../../i18n";

// Roles mode only. A Duke's choice, picked on the table (trick-pick.ts):
// once their 11 has won the trick, every other player's card in it rises,
// the label says "Grant the trick" with a "Keep it" button beside it. The
// player whose card is clicked is sent as `grant_trick`'s to; "Keep it"
// sends none.

export interface GrantPick {
  // Call after every game-state update: raises the cards to pick, or sets
  // them down.
  applyState(): void;
  // The server refused the choice: the cards rise again.
  refused(): void;
  dispose(): void;
}

export interface GrantPickOptions {
  pick: TrickPick;
  game: GameConnection;
  // While true nothing rises, e.g. until your turn is shown.
  blocked?(): boolean;
}

export function createGrantPick({ pick, game, blocked }: GrantPickOptions): GrantPick {
  // The cards up, and a choice on its way: nothing rises again until it is
  // answered.
  let raisedFor = "";
  let sending = false;

  const applyState = () => {
    const state = game.state();
    const open = state?.phase === "granting" && canAct(game) && isLocalTurn(game) && !blocked?.();
    if (!state || !open) {
      sending = false;
      if (raisedFor) pick.clear();
      raisedFor = "";
      return;
    }
    if (sending) return;
    // The cards by key, each with the player who holds it now.
    const holders = new Map(
      state.currentTrick.playedCards
        .filter((played) => played.username !== game.localUsername)
        .map((played) => [cardKey(played.card), played.username]),
    );
    const keys = [...holders.keys()];
    if (keys.join() === raisedFor) return;
    raisedFor = keys.join();
    const send = (to: string | null) => {
      raisedFor = "";
      sending = game.send({ type: "grant_trick", to });
    };
    pick.raise(keys, t("pick.grant"), (key) => send(holders.get(key) ?? null), {
      text: t("pick.keep"),
      onClick: () => send(null),
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
