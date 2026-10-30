import { DEFAULT_GAME_OPTIONS, type WizardGameOptions } from "../../backend/src/game/wizard/gameOptions";
import type { TurnTimeoutMs } from "../../backend/src/game/wizard/turnTimeout";
import { t } from "../i18n";

// "45 seconds" or "1 minute"; null is no limit.
const describeTurnTimeout = (turnTimeoutMs: TurnTimeoutMs) => {
  if (turnTimeoutMs === null) return t("rules.noTimeLimit");
  const seconds = turnTimeoutMs / 1000;
  if (seconds === 60) return t("rules.oneMinutePerMove");
  return seconds % 60 === 0
    ? t("rules.minutesPerMove", { count: String(seconds / 60) })
    : t("rules.secondsPerMove", { count: String(seconds) });
};

// One line naming the rule variations in play, in the order the room setup
// lists them, then the time per move, for players waiting on the host.
export function describeRuleVariations(
  options: WizardGameOptions,
  turnTimeoutMs: TurnTimeoutMs,
): string {
  const chosen = [
    options.blindFirstRound ? t("rules.blindFirstRound") : null,
    options.wizardWins === "last" ? t("rules.lastWizardWins") : null,
    options.lastPredictionLimited ? null : t("rules.lastPredictionFree"),
    options.missedTurnsToQuit === null
      ? t("rules.noMissedTurnsQuit")
      : options.missedTurnsToQuit !== DEFAULT_GAME_OPTIONS.missedTurnsToQuit
        ? t("rules.missedTurnsQuit", { count: String(options.missedTurnsToQuit) })
        : null,
  ].filter((variation): variation is string => variation !== null);

  const rules = chosen.length
    ? t("rules.variations", { list: chosen.join(" · ") })
    : t("rules.official");
  return `${rules} · ${describeTurnTimeout(turnTimeoutMs)}`;
}
