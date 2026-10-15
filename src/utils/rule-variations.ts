import type { WizardGameOptions } from "../../backend/src/game/wizard/gameOptions";

// One line naming the rule variations in play, in the order the room setup
// lists them, for players waiting on the host.
export function describeRuleVariations(options: WizardGameOptions): string {
  const chosen = [
    options.blindFirstRound ? "Blind first round" : null,
    options.wizardWins === "last" ? "Last Wizard wins" : null,
  ].filter((variation): variation is string => variation !== null);

  return chosen.length
    ? `Rule variations: ${chosen.join(" · ")}`
    : "Rule variations: none, official rules";
}
