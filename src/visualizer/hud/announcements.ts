import type { PublicGamePlayer, PublicWizardGameState } from "../../../backend/src/game/wizard/models/wizardGame";
import type { Card } from "../../../backend/src/game/wizard/models/card";

// What the top-centre banner says, worked out from game state alone. No DOM
// and no timing: announcer.ts decides when each line shows.

export interface RoundResult {
  username: string;
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

function ordinal(place: number): string {
  const tens = place % 100;
  if (tens >= 11 && tens <= 13) return `${place}th`;
  return `${place}${["th", "st", "nd", "rd"][place % 10] ?? "th"}`;
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

// When a round has just been scored: a line per player, lowest points first,
// ending with the round's winner. Empty otherwise.
export function roundResults(previous: PublicWizardGameState, next: PublicWizardGameState, local: string): RoundResult[] {
  const scored = next.players.filter((player) => {
    const before = previous.players.find((p) => p.username === player.username);
    return before && player.roundScores.length > before.roundScores.length;
  });
  if (!scored.length) return [];

  const last = (player: PublicGamePlayer) => player.roundScores[player.roundScores.length - 1]!;
  const ordered = [...scored].sort(
    (a, b) => last(a).score - last(b).score || b.username.localeCompare(a.username),
  );

  return ordered.map((player) => {
    const { prediction, tricksWon, score } = last(player);
    // Equal points share a place; only a sole top scorer wins the round, and
    // "last" needs someone above.
    const place = 1 + scored.filter((other) => last(other).score > score).length;
    const tied = scored.some((other) => other !== player && last(other).score === score);
    const lastPlace = place > 1 && !scored.some((other) => last(other).score < score);
    const is = player.username === local ? "are" : "is";
    const position = lastPlace ? "Last" : ordinal(place);
    const standing = `${nameOf(player.username, local)} ${is} ${tied ? `equal ${position}` : position}`;
    // Four lines: placement, whether the prediction came true, the points
    // multiplier, the round's total.
    const breakdown =
      prediction === tricksWon
        ? `True Prediction +20\nTricks ${tricksWon} * 10`
        : `False Prediction ${prediction}\nTricks ${tricksWon}, ${Math.abs(prediction - tricksWon)} * -10`;
    return {
      username: player.username,
      text: `${standing}\n${breakdown}\nTotal ${score} points!`,
      points: score,
      total: player.score,
    };
  });
}
