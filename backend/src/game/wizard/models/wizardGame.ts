import type { Card } from "./card.js";

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
  roundScores: number[];
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
  currentTrick: TrickState;
  status: "waiting" | "playing" | "finished";
  deck: Card[];
  phase: "predictions" | "playing" | "finished";
}

export interface PublicGamePlayer {
  username: string;
  hand: Card[];
  handCount: number;
  prediction: number | null;
  tricksWon: number;
  score: number;
}

export interface PublicWizardGameState {
  roomId: number;
  players: PublicGamePlayer[];
  currentRound: number;
  totalRounds: number;
  startingPlayerIndex: number;
  currentPlayerIndex: number;
  trumpCard: Card | null;
  currentTrick: TrickState;
  status: "waiting" | "playing" | "finished";
  phase: "predictions" | "playing" | "finished";
  deckCount: number;
}