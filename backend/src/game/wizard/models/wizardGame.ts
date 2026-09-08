import type { Card, Suit } from "./card.js";

export interface Room {
  id: number;
  name: string;
  createdBy: number;
  maxPlayers: number;
  players: string[];
  status: "waiting" | "playing";
}

export interface GamePlayer {
  username: string;
  hand: Card[];
  prediction: number | null;
  tricksWon: number;
  score: number;
  roundScores: RoundScore[];
}

export interface PlayedCard {
  username: string;
  card: Card;
}

export interface TrickState {
  playedCards: PlayedCard[];
  winnerUsername: string | null;
}

export interface WizardGameState {
  roomId: number;
  players: GamePlayer[];
  currentRound: number;
  totalRounds: number;
  startingPlayerIndex: number;
  currentPlayerIndex: number;
  trumpCard: Card | null;
  trumpSuit: Suit | null;
  currentTrick: TrickState;
  status: "waiting" | "playing" | "finished";
  deck: Card[];
  phase: "trump-selection" | "predictions" | "playing" | "finished";
}

export interface PublicGamePlayer {
  username: string;
  hand: Card[];
  handCount: number;
  prediction: number | null;
  tricksWon: number;
  score: number;
  roundScores: RoundScore[];
}

export interface PublicWizardGameState {
  roomId: number;
  players: PublicGamePlayer[];
  currentRound: number;
  totalRounds: number;
  startingPlayerIndex: number;
  currentPlayerIndex: number;
  trumpCard: Card | null;
  trumpSuit: Suit | null;
  currentTrick: TrickState;
  status: "waiting" | "playing" | "finished";
  phase: "trump-selection" | "predictions" | "playing" | "finished";
  deckCount: number;
}

export interface RoundScore {
  prediction: number;
  tricksWon: number;
  score: number;
}