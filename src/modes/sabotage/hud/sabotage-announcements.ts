import type { Card, Suit } from "../../../../backend/src/game/wizard/models/card";
import type { PublicWizardGameState } from "../../../../backend/src/game/wizard/models/wizardGame";
import type { CardPower, SabotagePower } from "../../../../backend/src/game/wizard/modes/sabotage/cardPowers";
import { t, type MessageKey } from "../../../i18n";
import { announcedName, type EventMessage } from "../../../visualizer/hud/announcements";
import { sabotageThiefInstruction } from "./sabotage-thief-instruction";

// What the banner says in a Sabotage game where it differs from Classic: the
// suits are elements, cards are named by their rank, and the Seer, Trickster
// and Thief are announced. The shared announcements.ts asks here when the
// table shows a Sabotage game.

export const elementName = (suit: Suit): string => t(`sabotage.element.${suit}`);

// Named by its rank in the hierarchy: "Fire Monarch".
export function sabotageCardName(card: Card): string {
  if (card.value === 14) return t("card.wizard");
  if (card.value === 0) return t("sabotage.fool");
  return t("sabotage.suitRank", {
    suit: elementName(card.suit),
    rank: t(`sabotage.rank.${card.value}` as MessageKey),
  });
}

// "Seer", "Trickster" or "Thief", by their rank in the hierarchy.
export const powerName = (kind: CardPower): string =>
  t(kind === "seer" ? "sabotage.rank.10" : kind === "trickster" ? "sabotage.rank.9" : "sabotage.rank.8");

// The standing line in the "power" phase: the winner of a trick with a Seer,
// Trickster or Thief decides how to use it.
export function powerStatus(state: PublicWizardGameState, local: string): string | null {
  const current = state.players[state.currentPlayerIndex]?.username;
  const power = state.currentTrick.sabotagePower;
  if (!current || !power) return null;
  const name = powerName(power.kind);
  // The Thief's winner is walked through the swap step by step.
  const steps = power.kind === "thief" && current === local ? sabotageThiefInstruction() : null;
  if (steps) return steps;
  return current === local
    ? t("sabotage.ann.usePower", { power: name })
    : t("sabotage.ann.usingPower", { name: announcedName(current), power: name });
}

// What a resolved power did, for the banner. A power left alone just says so,
// with no target named.
function powerMessage(power: SabotagePower, local: string): string {
  const mine = power.username === local;
  const kind = powerName(power.kind);

  if (power.kind === "thief" && power.target !== null) {
    const target = announcedName(power.target);
    const name = announcedName(power.username);
    if (mine) return t("sabotage.ann.youThiefUsed", { target });
    return power.target === local
      ? t("sabotage.ann.thiefUsedOnYou", { name })
      : t("sabotage.ann.thiefUsed", { name, target });
  }

  if (power.target === null || power.from === null || power.to === null) {
    return mine
      ? t("sabotage.ann.youPowerUnused", { power: kind })
      : t("sabotage.ann.powerUnused", { name: announcedName(power.username), power: kind });
  }

  const change = { from: String(power.from), to: String(power.to) };

  if (power.kind === "seer") {
    return mine
      ? t("sabotage.ann.youSeerUsed", change)
      : t("sabotage.ann.seerUsed", { name: announcedName(power.username), ...change });
  }

  if (power.target === local) {
    return t("sabotage.ann.tricksterUsedOnYou", { name: announcedName(power.username), ...change });
  }

  const target = announcedName(power.target);
  return mine
    ? t("sabotage.ann.youTricksterUsed", { target, ...change })
    : t("sabotage.ann.tricksterUsed", { name: announcedName(power.username), target, ...change });
}

// A power just used, or passed on; null when none was.
export function powerEvent(
  previous: PublicWizardGameState,
  next: PublicWizardGameState,
  local: string,
): EventMessage | null {
  const power = next.currentTrick.sabotagePower;
  if (!power?.resolved || previous.currentTrick.sabotagePower?.resolved) return null;

  return {
    text: powerMessage(power, local),
    username: power.username,
    ...(power.target && power.kind !== "thief"
      ? { changes: power.target, byOther: power.target !== power.username, source: power.username }
      : {}),
  };
}
