import type { PublicGamePlayer, PublicWizardGameState } from "../../../backend/src/game/wizard/models/wizardGame";
import type { Card } from "../../../backend/src/game/wizard/models/card";

// What the top-centre banner says, worked out from game state alone. No DOM
// and no timing: announcer.ts decides when each line shows.

export interface RoundResultLine {
  label: string;
  value: string; // signed, e.g. "+20" or "-10"
}

export interface RoundResult {
  username: string;
  // The breakdown: prediction, tricks, total, each a label and a signed value.
  lines: RoundResultLine[];
  // The same as plain text, one line each.
  text: string;
  // This round's points, and the running total once they're added.
  points: number;
  total: number;
}

const nameOf = (username: string, local: string) => (username === local ? "You" : username);

export function cardName(card: Card): string {
  if (card.value === 14) return "Wizard";
  if (card.value === 0) return "Jester";
  return `${card.suit} ${card.value}`;
}

// After the server refuses a card: the follow-suit rule, with the suit led.
export function followSuitMessage(state: PublicWizardGameState): string {
  const led = state.currentTrick.playedCards.find(({ card }) => card.value !== 0)?.card.suit;
  return led
    ? `${led} was led: play ${led} if you can, or a Wizard or Jester.`
    : "Follow the suit led if you can; Wizards and Jesters can be played any time.";
}

// The standing line for the current moment: whose move it is.
export function statusMessage(state: PublicWizardGameState, local: string): string | null {
  const current = state.players[state.currentPlayerIndex]?.username;
  switch (state.phase) {
    case "trump-selection": {
      if (!current) return null;
      const turnedUp = `${state.trumpCard?.value === 14 ? "A Wizard" : "A Jester"} was turned up for trumps`;
      return current === local ? `${turnedUp}: choose the trump suit.` : `${turnedUp}: ${current} is choosing the suit.`;
    }
    case "predictions": {
      if (!current) return null;
      // Predictions go in dealing order: first, next, ..., last.
      const made = state.players.filter((player) => player.prediction !== null).length;
      const order = made === 0 ? "first" : made === state.players.length - 1 ? "last" : "next";
      return `${nameOf(current, local)} ${current === local ? "Predict" : "Predicts"} ${order}`;
    }
    case "playing":
      // A finished trick keeps its own announcement until the next one starts.
      if (!current || state.currentTrick.winnerUsername) return null;
      // The first card of each trick: that player leads.
      if (state.currentTrick.playedCards.length === 0) {
        return current === local ? "You lead" : `${current} leads`;
      }
      return current === local ? "Your Turn." : `${current}'s turn.`;
    case "finished": {
      const winner = [...state.players].sort((a, b) => b.score - a.score)[0];
      if (!winner) return "Game over.";
      return `${nameOf(winner.username, local)} ${winner.username === local ? "Win" : "Wins"} the Game!`;
    }
  }
}

// One-off events between two snapshots, in the order they happened: new
// predictions, then a trick being won.
export function eventMessages(previous: PublicWizardGameState, next: PublicWizardGameState, local: string): string[] {
  const messages: string[] = [];

  if (previous.currentRound === next.currentRound) {
    for (const player of next.players) {
      const before = previous.players.find((p) => p.username === player.username);
      if (before?.prediction === null && player.prediction !== null) {
        const tricks = player.prediction === 1 ? "Trick" : "Tricks";
        const predicts = player.username === local ? "Predict" : "Predicts";
        messages.push(`${nameOf(player.username, local)} ${predicts} ${player.prediction} ${tricks}`);
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
    if (chooser) messages.push(`${nameOf(chooser, local)} chose ${next.trumpSuit} as trumps.`);
  }

  const winner = next.currentTrick.winnerUsername;
  if (winner && previous.currentTrick.winnerUsername !== winner) {
    const played = next.currentTrick.playedCards.find((entry) => entry.username === winner);
    const wins = winner === local ? "Win" : "Wins";
    messages.push(`${nameOf(winner, local)} ${wins} the Trick${played ? ` with ${cardName(played.card)}` : ""}`);
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
  // "2 * 10" with non-breaking spaces, so a label wraps before it, not inside it.
  const times = (count: number) => `${count}\u00a0*\u00a010`;
  // Every value carries its sign, so the signs line up in a column.
  const signed = (points: number) => (points >= 0 ? `+${points}` : String(points));
  const ordered = [...scored].sort(
    (a, b) => last(b).score - last(a).score || a.username.localeCompare(b.username),
  );

  return ordered.map((player) => {
    const { prediction, tricksWon, score } = last(player);
    const off = Math.abs(prediction - tricksWon);
    const lines: RoundResultLine[] = [
      ...(prediction === tricksWon
        ? [
            { label: "Prediction Bonus", value: "+20" },
            { label: `Trick Bonus ${times(tricksWon)}`, value: signed(tricksWon * 10) },
          ]
        : [
            { label: "False Prediction", value: "+0" },
            { label: `Prediction Off By ${times(off)}`, value: signed(-off * 10) },
          ]),
      { label: "Total Points", value: signed(score) },
    ];
    return {
      username: player.username,
      lines,
      text: lines.map((line) => `${line.label} ${line.value}`).join("\n"),
      points: score,
      total: player.score,
    };
  });
}
