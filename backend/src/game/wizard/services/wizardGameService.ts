import { DeckService } from "./deckService.js";
import { WizardRules } from "./wizardRules.js";
import { isJester, isWizard } from "../models/card.js";
import { ScoreCalculator } from "./wizardScoreCalculator.js";

import type {
  GamePlayer,
  PlayedCard,
  PublicWizardGameState,
  TrickState,
  WizardGameState,
} from "../models/wizardGame.js";

import type { Suit } from "../models/card.js";
import { AVATAR_IDS, type AvatarId } from "../models/avatar.js";

const ROUND_COUNT_BY_PLAYER_NUMBER: Record<number, number> = {
  3: 20,
  4: 15,
  5: 12,
  6: 10,
};

// Players keep the avatar they claimed in the lobby. Bots, and anyone who
// never chose, get a random avatar from those left, so everyone has one.
function assignAvatars(
  usernames: string[],
  claimedAvatars: ReadonlyMap<string, AvatarId | null>,
): AvatarId[] {
  const taken = new Set<AvatarId>();

  const claims = usernames.map((username) => {
    const avatar = claimedAvatars.get(username) ?? null;

    if (avatar === null || taken.has(avatar)) {
      return null;
    }

    taken.add(avatar);
    return avatar;
  });

  const unclaimed = AVATAR_IDS.filter((avatar) => !taken.has(avatar));

  // Fisher-Yates shuffle of the leftovers.
  for (let i = unclaimed.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const swap = unclaimed[i] as AvatarId;
    unclaimed[i] = unclaimed[j] as AvatarId;
    unclaimed[j] = swap;
  }

  return claims.map((avatar) => {
    const assigned = avatar ?? unclaimed.shift();

    if (!assigned) {
      throw new Error("Not enough avatars for every player");
    }

    return assigned;
  });
}

// Owns the mutable game state and enforces the order of Wizard phases. Rule
// comparisons stay in WizardRules so this service remains an orchestrator.
export class WizardGameService {
  private readonly rules = new WizardRules();
  private readonly scoreCalculator = new ScoreCalculator();
  createGame(
    roomId: number,
    usernames: string[],
    claimedAvatars: ReadonlyMap<string, AvatarId | null> = new Map(),
  ): WizardGameState {
    if (usernames.length < 3 || usernames.length > 6) {
      throw new Error("Wizard games require 3 to 6 players");
    }
  // The number of rounds is derived from the fixed 60-card deck.
  const totalRounds = ROUND_COUNT_BY_PLAYER_NUMBER[usernames.length];

	if (totalRounds === undefined) {
	throw new Error("Unsupported player count");
	}

    const avatars = assignAvatars(usernames, claimedAvatars);

    const players: GamePlayer[] = usernames.map((username, index) => ({
      username,
      avatar: avatars[index] as AvatarId,
      hand: [],
      prediction: null,
      tricksWon: 0,
      score: 0,
      roundScores: [],
    }));

    const currentTrick: TrickState = {
      playedCards: [],
      winnerUsername: null,
    };

    const deck = new DeckService();
    deck.shuffle();

    const game: WizardGameState = {
      roomId,
      players,
      currentRound: 1,
      totalRounds,
      startingPlayerIndex: 0,
      currentPlayerIndex: 0,
      trumpCard: null,
      trumpSuit: null,
      currentTrick,
      status: "waiting",
      deck: deck.getCards(),
      phase: "predictions",
    };

    this.dealRound(game);
    this.drawTrumpCard(game);

    return game;
  }

  dealRound(game: WizardGameState): void {
    // Each round starts with fresh hands and trick counters. Cumulative scores
    // remain on the players across rounds.
    const cardsPerPlayer = game.currentRound;

    for (const player of game.players) {
      player.hand = [];
      player.prediction = null;
      player.tricksWon = 0;

      for (let cardIndex = 0; cardIndex < cardsPerPlayer; cardIndex++) {
        const card = game.deck.pop();

        if (!card) {
          throw new Error("The deck ran out of cards");
        }

        player.hand.push(card);
      }
    }
  }

  drawTrumpCard(game: WizardGameState): void {
    // The final round uses every remaining card for hands, so no trump card is
    // drawn. A Wizard or a Jester turned up has no suit of its own, so the
    // round's first player chooses the trump suit.
    if (game.currentRound === game.totalRounds) {
      game.trumpCard = null;
      game.trumpSuit = null;
      return;
    }

    const trumpCard = game.deck.pop();

    if (!trumpCard) {
      throw new Error("The deck ran out of cards while drawing trump");
    }

    game.trumpCard = trumpCard;

    if (isJester(trumpCard) || isWizard(trumpCard)) {
      game.trumpSuit = null;
      game.phase = "trump-selection";
      return;
    }

    game.trumpSuit = this.rules.getTrumpSuit(trumpCard);
  }

  playCard(
    game: WizardGameState,
    cardIndex: number,
  ): void {
    // This method validates and records one play. A complete trick is resolved
    // immediately, while the caller advances to the next trick afterward.

    if (game.phase !== "playing") {
      throw new Error("Cards cannot be played yet");
    }
    if (
      game.currentTrick.playedCards.length ===
      game.players.length
    ) {
      throw new Error(
        "The current trick is complete. Waiting for it to be resolved.",
      );
    }

    const currentPlayer = game.players[game.currentPlayerIndex];

    if (!currentPlayer) {
      throw new Error("Current player does not exist");
    }

    if (
      !Number.isInteger(cardIndex) ||
      cardIndex < 0 ||
      cardIndex >= currentPlayer.hand.length
    ) {
      throw new Error("Invalid card index");
    }

    const card = currentPlayer.hand[cardIndex];

    if (!card) {
      throw new Error("Card does not exist");
    }

    const leadSuit =
      game.currentTrick.playedCards.find(
        ({ card: playedCard }) => !isJester(playedCard),
      )?.card.suit ?? null;

    if (
      !this.rules.isValidCardPlay(
        card,
        currentPlayer.hand,
        leadSuit,
      )
    ) {
      throw new Error("Card cannot be played");
    }

    currentPlayer.hand.splice(cardIndex, 1);

    const playedCard: PlayedCard = {
      username: currentPlayer.username,
      card,
    };

    game.currentTrick.playedCards.push(playedCard);

    if (game.currentTrick.playedCards.length === game.players.length) {
      this.resolveTrick(game);
      return;
    }

    game.currentPlayerIndex =
      (game.currentPlayerIndex + 1) % game.players.length;
  }

  resolveTrick(game: WizardGameState): string {
    if (game.currentTrick.playedCards.length !== game.players.length) {
      throw new Error("The trick is not complete");
    }

    // The winner leads the next trick, so update the turn index as part of
    // resolving the current trick rather than when the next trick begins.
    const winnerUsername = this.rules.determineTrickWinner(
      game.currentTrick.playedCards,
      game.trumpSuit,
      game.currentRound === game.totalRounds,
    );

    if (!winnerUsername) {
      throw new Error("Could not determine trick winner");
    }

    const winnerIndex = game.players.findIndex(
      (player) => player.username === winnerUsername,
    );

    if (winnerIndex === -1) {
      throw new Error("Trick winner is not in the game");
    }

    const winner = game.players[winnerIndex];

    if (!winner) {
      throw new Error("Trick winner does not exist");
    }

    winner.tricksWon += 1;
    game.currentTrick.winnerUsername = winnerUsername;
    game.currentPlayerIndex = winnerIndex;

    return winnerUsername;
  }

  startNextTrick(game: WizardGameState): void {
    game.currentTrick = {
      playedCards: [],
      winnerUsername: null,
    };
  }

  submitPrediction(
    game: WizardGameState,
    username: string,
    prediction: number,
  ): void {
    // Predictions are collected in rotation. Once all are present, play starts
    // with the round's starting player, not the player who bid last.
    const currentPlayer = game.players[game.currentPlayerIndex];

    if (game.phase !== "predictions") {
      throw new Error("Predictions are not currently being accepted");
    }

    if (!currentPlayer) {
      throw new Error("Current player does not exist");
    }

    if (currentPlayer.username !== username) {
      throw new Error("It is not this player's turn");
    }

    if (!Number.isInteger(prediction)) {
      throw new Error("Prediction must be a whole number");
    }

    if (prediction < 0 || prediction > game.currentRound) {
      throw new Error(
        `Prediction must be between 0 and ${game.currentRound}`,
      );
    }

    if (currentPlayer.prediction !== null) {
      throw new Error("Player has already submitted a prediction");
    }

    currentPlayer.prediction = prediction;

    const allPredictionsSubmitted = game.players.every(
      (player) => player.prediction !== null,
    );
    
    if (allPredictionsSubmitted) {
      game.phase = "playing";
      game.currentPlayerIndex = game.startingPlayerIndex;
      return;
    } else {
      game.currentPlayerIndex =
        (game.currentPlayerIndex + 1) % game.players.length;
    }
  }

  finishRound(game: WizardGameState): void {
    // Scores are calculated before either ending the game or preparing the next
    // round, ensuring the final round is included in the results.
    if (game.players.some((player) => player.prediction === null)) {
      throw new Error("All players must submit predictions");
    }

    this.scoreCalculator.updatePlayerScores(game);

    if (game.currentRound === game.totalRounds) {
      game.status = "finished";
      game.phase = "finished";
      return;
    }

    game.currentRound += 1;
    game.startingPlayerIndex =
      (game.startingPlayerIndex + 1) % game.players.length;

    game.currentPlayerIndex = game.startingPlayerIndex;

    game.currentTrick = {
      playedCards: [],
      winnerUsername: null,
    };

    const deck = new DeckService();
    deck.shuffle();
    game.deck = deck.getCards();

    game.phase = "predictions";
    this.dealRound(game);
    this.drawTrumpCard(game);
  }

  getPublicGameState(
    game: WizardGameState,
    username: string,
  ): PublicWizardGameState {
    // Hide every other player's hand while preserving card counts for the UI.
    const requestingPlayer = game.players.find(
      (player) => player.username === username,
    );

    if (!requestingPlayer) {
      throw new Error("You are not a player in this game");
    }

    return {
      roomId: game.roomId,
      players: game.players.map((player) => ({
        username: player.username,
        avatar: player.avatar,
        hand:
          player.username === username
            ? player.hand
            : [],
        handCount: player.hand.length,
        prediction: player.prediction,
        tricksWon: player.tricksWon,
        score: player.score,
        roundScores: player.roundScores,
      })),
      currentRound: game.currentRound,
      totalRounds: game.totalRounds,
      startingPlayerIndex: game.startingPlayerIndex,
      currentPlayerIndex: game.currentPlayerIndex,
      trumpCard: game.trumpCard,
      trumpSuit: game.trumpSuit,
      currentTrick: game.currentTrick,
      status: game.status,
      phase: game.phase,
      deckCount: game.deck.length,
    };
  }

  advanceAfterTrick(game: WizardGameState): void {
    const allHandsEmpty = game.players.every(
      (player) => player.hand.length === 0,
    );

    if (allHandsEmpty) {
      this.finishRound(game);
    } else {
      this.startNextTrick(game);
    }
  }

  chooseTrumpSuit(
    game: WizardGameState,
    username: string,
    suit: Suit,
  ): void {
    // Only the round's first player may choose the suit after a Wizard or Jester, and
    // selecting it moves the game back into the prediction phase.
    if (game.phase !== "trump-selection") {
      throw new Error("Trump suit cannot be selected right now");
    }

    const currentPlayer = game.players[game.currentPlayerIndex];

    if (!currentPlayer) {
      throw new Error("Current player does not exist");
    }

    if (currentPlayer.username !== username) {
      throw new Error("It is not this player's turn");
    }

    if (!["Blue", "Red", "Yellow", "Green"].includes(suit)) {
      throw new Error("Invalid trump suit");
    }

    game.trumpSuit = suit;
    game.phase = "predictions";
  }
}