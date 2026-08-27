import { DeckService } from "./deckService.js";
import type {
  GamePlayer,
  TrickState,
  WizardGameState,
} from "../models/wizardGame.js";

const ROUND_COUNT_BY_PLAYER_NUMBER: Record<number, number> = {
  3: 20,
  4: 15,
  5: 12,
  6: 10,
};

export class WizardGameService {
  createGame(
    roomId: number,
    usernames: string[],
  ): WizardGameState {
    if (usernames.length < 3 || usernames.length > 6) {
      throw new Error("Wizard games require 3 to 6 players");
    }

    const totalRounds =
	ROUND_COUNT_BY_PLAYER_NUMBER[usernames.length];

	if (totalRounds === undefined) {
	throw new Error("Unsupported player count");
	}

    const players: GamePlayer[] = usernames.map((username) => ({
      username,
      hand: [],
      prediction: null,
      tricksWon: 0,
      score: 0,
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
      currentPlayerIndex: 0,
      trumpCard: null,
      currentTrick,
      status: "waiting",
      deck: deck.getCards(),
    };

    this.dealRound(game);
    this.drawTrumpCard(game);

    return game;
  }

  dealRound(game: WizardGameState): void {
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
    if (game.currentRound === game.totalRounds) {
      game.trumpCard = null;
      return;
    }

    const trumpCard = game.deck.pop();

    if (!trumpCard) {
      throw new Error("The deck ran out of cards while drawing trump");
    }

    game.trumpCard = trumpCard;
  }
}