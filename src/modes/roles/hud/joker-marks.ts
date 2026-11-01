import type { PublicGamePlayer } from "../../../../backend/src/game/wizard/models/wizardGame";
import { JOKER_MAX, JOKER_TRICKS } from "../../../../backend/src/game/wizard/modes/roles/master/joker";
import { t } from "../../../i18n";

// Roles mode only. A Joker's points and tricks towards the next, after their
// role in the player list (visualizer/hud/player-list.ts): "Joker: 🃏2 · 1/3",
// just "🃏3" when full, as no trick counts then.

export function jokerMarks(player: PublicGamePlayer): string {
  if (player.role !== "joker") return "";
  const points = player.jokerPoints ?? 0;
  return points >= JOKER_MAX ? ` \u{1F0CF}${points}` : ` \u{1F0CF}${points} · ${player.jokerTricks ?? 0}/${JOKER_TRICKS}`;
}

// The same, in words, for screen readers.
export function jokerCarried(player: PublicGamePlayer): string {
  if (player.role !== "joker") return "";
  return t("game.jokerPoints", {
    count: String(player.jokerPoints ?? 0),
    tricks: String(player.jokerTricks ?? 0),
    of: String(JOKER_TRICKS),
  });
}
