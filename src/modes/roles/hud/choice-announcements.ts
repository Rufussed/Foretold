import type { PlayedCard, PublicWizardGameState } from "../../../../backend/src/game/wizard/models/wizardGame";
import type { EventMessage } from "../../../visualizer/hud/announcements";
import { t } from "../../../i18n";

// Roles mode only. What the banner says as a role's choice made with a card
// comes out, so everyone knows before the trick is out: a Gambler betting on
// their 10, a Prophet lowering her prediction with her 12 or keeping it. A
// lowered prediction carries `changes`, so the player list shows the new
// number as this is read out (visualizer/hud/player-list.ts), at once rather
// than after its fallback wait; Sabotage's own changes are told in
// modes/sabotage/hud/sabotage-announcements.ts. Played cards outside a Roles
// game never carry a bet or a prediction choice, so this says nothing there.
export function choiceMessages(
  newPlays: readonly PlayedCard[],
  next: PublicWizardGameState,
  local: string,
  // How a banner names a player (visualizer/hud/announcements.ts).
  nameOf: (username: string) => string,
): EventMessage[] {
  return newPlays.flatMap((played) => {
    if (!played.bet && played.lowered === undefined) return [];
    const by = played.playedBy ?? played.username;
    const name = nameOf(by);
    const prediction = String(next.players.find((player) => player.username === by)?.prediction ?? 0);
    const text = played.bet
      ? by === local ? t("ann.youBet") : t("ann.bets", { name })
      : played.lowered
        ? by === local ? t("ann.youLower", { prediction }) : t("ann.lowers", { name, prediction })
        : by === local ? t("ann.youKeepBid", { prediction }) : t("ann.keepsBid", { name, prediction });
    return [{ text, username: by, role: true, ...(played.lowered ? { changes: by } : {}) }];
  });
}
