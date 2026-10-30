import { displayName } from "../../utils/display-name";
import { gameWinners } from "./game-winner";
import { thiefInstruction } from "../thief-instruction";
import type { PublicGamePlayer, PublicWizardGameState, TrickPower } from "../../../backend/src/game/wizard/models/wizardGame";
import type { Card, CardPower, Suit } from "../../../backend/src/game/wizard/models/card";
import { t, type MessageKey } from "../../i18n";
import { EXACT_PREDICTION_BONUS, POINTS_PER_TRICK } from "../../../backend/src/game/wizard/scoringRules";

// What the top-centre banner says, worked out from game state alone. No DOM
// and no timing: announcer.ts decides when each line shows.

export interface RoundResultLine {
  label: string;
  value: string; // signed, e.g. "+2" or "-1"
}

export interface RoundResult {
  username: string;
  // What was predicted against what was won: "Predicted 2 · Won 2".
  summary: string;
  // How the points came about, a label and a signed value each (a hit: the
  // bonus and the tricks; a miss: how far off, with no value of its own).
  lines: RoundResultLine[];
  // The same as plain text, one line each.
  text: string;
  // This round's points, and the running total once they're added.
  points: number;
  total: number;
}

// A bot's username ends in " NPC", which the banner leaves off.
export const announcedName = (username: string): string =>
  displayName(username).replace(/ NPC$/, "");

const nameOf = (username: string, local: string) => (username === local ? t("ann.you") : announcedName(username));

export const suitName = (suit: Suit): string => t(`suit.${suit}`);

export function cardName(card: Card): string {
  if (card.value === 14) return t("card.wizard");
  if (card.value === 0) return t("card.jester");
  // Named by its rank in the hierarchy: "Fire Monarch".
  return t("card.suitRank", { suit: suitName(card.suit), rank: t(`rank.${card.value}` as MessageKey) });
}

// "Seer", "Trickster" or "Thief", by their rank in the hierarchy.
export const powerName = (kind: CardPower): string =>
  t(kind === "seer" ? "rank.10" : kind === "trickster" ? "rank.9" : "rank.8");

// "A Wizard was turned up for trumps", or a Jester.
export const turnedUpMessage = (card: Card | null) =>
  t(card?.value === 14 ? "game.wizardTurnedUp" : "game.jesterTurnedUp");

// After the server refuses a card: the follow-suit rule, with the suit led.
export function followSuitMessage(state: PublicWizardGameState): string {
  const led = state.currentTrick.playedCards.find(({ card }) => card.value !== 0)?.card.suit;
  return led ? t("ann.followSuit", { suit: suitName(led) }) : t("ann.followSuitAny");
}

// The player the standing line is about, whose colour its border takes: whoever's
// move it is. Null when it isn't about one player.
export function statusSubject(state: PublicWizardGameState): string | null {
  if (state.phase === "finished") return null;
  return state.players[state.currentPlayerIndex]?.username ?? null;
}

// The standing line for the current moment: whose move it is.
export function statusMessage(state: PublicWizardGameState, local: string): string | null {
  const current = state.players[state.currentPlayerIndex]?.username;
  switch (state.phase) {
    case "trump-selection": {
      if (!current) return null;
      const turnedUp = turnedUpMessage(state.trumpCard);
      return current === local
        ? t("ann.chooseTrump", { turnedUp })
        : t("ann.othersChoosing", { turnedUp, name: announcedName(current) });
    }
    case "predictions": {
      if (!current) return null;
      // Predictions go in dealing order: first, next, ..., last.
      const made = state.players.filter((player) => player.prediction !== null).length;
      const order = made === 0 ? "first" : made === state.players.length - 1 ? "last" : "next";
      const when = t(`ann.order.${order}`);
      return current === local
        ? t("ann.youPredictOrder", { order: when })
        : t("ann.predictsOrder", { name: announcedName(current), order: when });
    }
    case "power": {
      // The winner of a trick with a Seer or Trickster decides how to use it.
      const power = state.currentTrick.power;
      if (!current || !power) return null;
      const name = powerName(power.kind);
      // The Thief's winner is walked through the swap step by step.
      const steps = power.kind === "thief" && current === local ? thiefInstruction() : null;
      if (steps) return steps;
      return current === local
        ? t("ann.usePower", { power: name })
        : t("ann.usingPower", { name: announcedName(current), power: name });
    }
    case "playing":
      // A finished trick keeps its own announcement until the next one starts.
      if (!current || state.currentTrick.winnerUsername) return null;
      // The first card of each trick: that player leads.
      if (state.currentTrick.playedCards.length === 0) {
        return current === local ? t("ann.youLead") : t("ann.leads", { name: announcedName(current) });
      }
      return current === local ? t("ann.yourTurn") : t("ann.turn", { name: announcedName(current) });
    case "finished": {
      const winners = gameWinners(state);
      const winner = winners[0];
      if (!winner) return t("ann.gameOver");
      if (winners.length > 1) {
        const names = winners.map((player) => nameOf(player.username, local));
        const listed = t("ann.and", { names: names.slice(0, -1).join(", "), last: names.at(-1)! });
        return t("ann.tie", { names: listed });
      }
      return winner.username === local
        ? t("ann.youWin")
        : t("ann.wins", { name: announcedName(winner.username) });
    }
  }
}

// Said once a round's cards are dealt and the trump card is showing: which suit
// is trumps. A Wizard or Jester turned up has its own announcements (the
// choosing), so it says nothing here; the last round has no trump card at all.
export function trumpMessage(state: PublicWizardGameState): string | null {
  const card = state.trumpCard;
  if (!card) return t("ann.noTrump");
  if (card.value === 14 || card.value === 0) return null;
  return state.trumpSuit ? t("ann.trumpIs", { suit: suitName(state.trumpSuit) }) : null;
}

// A one-off announcement, and the player it's about.
export interface EventMessage {
  text: string;
  username: string;
  // A player whose prediction this announcement is about (a Seer or Trickster
  // changed it): the bottom-left list swaps in the new number as it is read out.
  changes?: string;
  // A Trickster at work: someone else's prediction was changed, not the
  // player's own.
  byOther?: boolean;
  // Whose power changed it, for the Trickster's tesseract to fly from.
  source?: string;
}

// What a resolved power did, for the banner. A power left alone just says so,
// with no target named.
function powerMessage(power: TrickPower, local: string): string {
  const mine = power.username === local;
  const kind = powerName(power.kind);

  if (power.kind === "thief" && power.target !== null) {
    const target = announcedName(power.target);
    const name = announcedName(power.username);
    if (mine) return t("ann.youThiefUsed", { target });
    return power.target === local ? t("ann.thiefUsedOnYou", { name }) : t("ann.thiefUsed", { name, target });
  }

  if (power.target === null || power.from === null || power.to === null) {
    return mine
      ? t("ann.youPowerUnused", { power: kind })
      : t("ann.powerUnused", { name: announcedName(power.username), power: kind });
  }

  const change = { from: String(power.from), to: String(power.to) };

  if (power.kind === "seer") {
    return mine
      ? t("ann.youSeerUsed", change)
      : t("ann.seerUsed", { name: announcedName(power.username), ...change });
  }

  if (power.target === local) {
    return t("ann.tricksterUsedOnYou", { name: announcedName(power.username), ...change });
  }

  const target = announcedName(power.target);
  return mine
    ? t("ann.youTricksterUsed", { target, ...change })
    : t("ann.tricksterUsed", { name: announcedName(power.username), target, ...change });
}

// One-off events between two snapshots, in the order they happened: new
// predictions, then a trick being won.
export function eventMessages(previous: PublicWizardGameState, next: PublicWizardGameState, local: string): EventMessage[] {
  const messages: EventMessage[] = [];

  if (previous.currentRound === next.currentRound) {
    for (const player of next.players) {
      const before = previous.players.find((p) => p.username === player.username);
      if (before?.prediction === null && player.prediction !== null) {
        const one = player.prediction === 1;
        const values = { name: announcedName(player.username), count: String(player.prediction) };
        messages.push({
          text:
            player.username === local
              ? t(one ? "ann.youPredictOne" : "ann.youPredictMany", values)
              : t(one ? "ann.predictsOne" : "ann.predictsMany", values),
          username: player.username,
        });
      }
    }
  }

  // A suit chosen for a Wizard or Jester. A bot can choose before any update
  // shows it choosing, so this also covers a new round arriving already chosen.
  const special = next.trumpCard && (next.trumpCard.value === 14 || next.trumpCard.value === 0);
  const newlyChosen = previous.currentRound !== next.currentRound || !previous.trumpSuit;
  if (special && next.trumpSuit && newlyChosen) {
    // The round's first player chooses.
    const chooser = next.players[next.startingPlayerIndex]?.username;
    if (chooser) {
      const suit = suitName(next.trumpSuit);
      messages.push({
        text: chooser === local ? t("ann.youChose", { suit }) : t("ann.chose", { name: announcedName(chooser), suit }),
        username: chooser,
      });
    }
  }

  // A Seer or Trickster's power just used, or passed on.
  const power = next.currentTrick.power;
  if (power?.resolved && !previous.currentTrick.power?.resolved) {
    messages.push({
      text: powerMessage(power, local),
      username: power.username,
      ...(power.target && power.kind !== "thief"
        ? { changes: power.target, byOther: power.target !== power.username, source: power.username }
        : {}),
    });
  }

  const winner = next.currentTrick.winnerUsername;
  if (winner && previous.currentTrick.winnerUsername !== winner) {
    const played = next.currentTrick.playedCards.find((entry) => entry.username === winner);
    const wins = winner === local ? t("ann.youWinTrick") : t("ann.winsTrick", { name: announcedName(winner) });
    const card = played?.card;
    const withCard = !card
      ? ""
      : card.value === 14
        ? t("ann.withWizard")
        : card.value === 0
          ? t("ann.withJester")
          : t("ann.withCard", { card: cardName(card) });
    messages.push({
      text: `${wins}${withCard}`,
      username: winner,
    });
  }

  return messages;
}

// When a round has just been scored: a result per player, the round's best
// first and the rest in descending order. Empty otherwise.
export function roundResults(previous: PublicWizardGameState, next: PublicWizardGameState): RoundResult[] {
  const scored = next.players.filter((player) => {
    const before = previous.players.find((p) => p.username === player.username);
    return before && player.roundScores.length > before.roundScores.length;
  });
  if (!scored.length) return [];

  const last = (player: PublicGamePlayer) => player.roundScores[player.roundScores.length - 1]!;
  // Every value carries its sign, so the signs line up in a column.
  const signed = (points: number) => (points >= 0 ? `+${points}` : String(points));
  const ordered = [...scored].sort(
    (a, b) => last(b).score - last(a).score || a.username.localeCompare(b.username),
  );

  return ordered.map((player) => {
    const { prediction, tricksWon, score } = last(player);
    const off = Math.abs(prediction - tricksWon);
    const lines: RoundResultLine[] =
      prediction === tricksWon
        ? [
            { label: t("ann.bonus"), value: signed(EXACT_PREDICTION_BONUS) },
            { label: t("ann.tricks"), value: signed(tricksWon * POINTS_PER_TRICK) },
          ]
        : [{ label: t("ann.offBy", { off: String(off) }), value: "" }];
    const summary = t("ann.predictedWon", { prediction: String(prediction), won: String(tricksWon) });
    return {
      username: player.username,
      summary,
      lines,
      text: [summary, lines.map((line) => `${line.label} ${line.value}`.trim()).join(" \u00b7 "), signed(score)].join("\n"),
      points: score,
      total: player.score,
    };
  });
}
