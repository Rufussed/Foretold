import type { WizardGameOptions } from "../../backend/src/game/wizard/gameOptions";
import type { TurnTimeoutMs } from "../../backend/src/game/wizard/turnTimeout";

// "45 seconds" or "1 minute"; null is no limit.
const describeTurnTimeout = (turnTimeoutMs: TurnTimeoutMs) => {
  if (turnTimeoutMs === null) return "No time limit";
  const seconds = turnTimeoutMs / 1000;
  return seconds % 60 === 0
    ? `${seconds / 60} minute${seconds === 60 ? "" : "s"} per move`
    : `${seconds} seconds per move`;
};

// One line naming the rule variations in play, in the order the room setup
// lists them, then the time per move, for players waiting on the host.
export function describeRuleVariations(
  options: WizardGameOptions,
  turnTimeoutMs: TurnTimeoutMs,
): string {
  const chosen = [
    options.blindFirstRound ? "Blind first round" : null,
    options.wizardWins === "last" ? "Last Wizard wins" : null,
  ].filter((variation): variation is string => variation !== null);

  const rules = chosen.length
    ? `Rule variations: ${chosen.join(" · ")}`
    : "Rule variations: none, official rules";
  return `${rules} · ${describeTurnTimeout(turnTimeoutMs)}`;
}
