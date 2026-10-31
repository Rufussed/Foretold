import type { Card } from "../../../../backend/src/game/wizard/models/card";
import { stealSpots } from "../../../../backend/src/game/wizard/modes/roles/thief";
import { cardKey } from "../../../visualizer/card-textures";
import { isLocalTurn, localPlayer, type GameConnection } from "../../../visualizer/game-connection";
import type { TrickPick } from "./trick-pick";
import { t } from "../../../i18n";

// Roles mode only. A Thief's trump 1, choosing on the table (trick-pick.ts):
// when you play your 1 as a trump with more than one card it could take, the
// cards it may take rise, the banner says to click one, and the place of the
// one clicked goes to the server with the card, as play_card's stealSpot.

export interface StealPick {
  // Before the local player's card is sent: the place in the trick of the
  // card their Thief's trump 1 takes. Undefined when there is nothing to
  // choose, null when the turn passed before a choice, e.g. time ran out.
  ask(cardIndex: number): Promise<number | null | undefined>;
  // Call after every game-state update; sets the cards down once the turn
  // has passed.
  applyState(): void;
  // True while asking: the banner says to pick a card.
  asking(): boolean;
  dispose(): void;
}

export interface StealPickOptions {
  pick: TrickPick;
  game: GameConnection;
  // The choice has started or ended, for the banner to say so.
  onChange?(): void;
}

// The places a trump 1 just played by the local player could take from.
function spotsFor(game: GameConnection, card: Card): number[] {
  const state = game.state();
  if (!state) return [];
  const local = game.localUsername;
  const roleOf = (username: string) => state.players.find((player) => player.username === username)?.role ?? undefined;
  return stealSpots(
    [...state.currentTrick.playedCards, { username: local, playedBy: local, card }],
    state.trumpSuit,
    roleOf,
  );
}

export function createStealPick({ pick, game, onChange }: StealPickOptions): StealPick {
  let answer: ((spot: number | null) => void) | null = null;

  const finish = (spot: number | null) => {
    const resolve = answer;
    answer = null;
    resolve?.(spot);
    onChange?.();
  };

  return {
    ask(cardIndex) {
      const card = localPlayer(game)?.hand[cardIndex];
      const spots = card ? spotsFor(game, card) : [];
      if (spots.length < 2) return Promise.resolve(undefined);

      finish(null);
      const playedCards = game.state()!.currentTrick.playedCards;
      const byKey = new Map(spots.map((spot) => [cardKey(playedCards[spot]!.card), spot]));
      const promise = new Promise<number | null>((resolve) => {
        answer = resolve;
      });
      pick.raise([...byKey.keys()], t("pick.steal"), (key) => finish(byKey.get(key) ?? null));
      onChange?.();
      return promise;
    },

    applyState() {
      if (answer && (game.state()?.phase !== "playing" || !isLocalTurn(game))) {
        pick.clear();
        finish(null);
      }
    },

    asking: () => answer !== null,

    dispose() {
      if (answer) pick.clear();
      finish(null);
    },
  };
}
