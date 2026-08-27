export interface Room {
  id: number;
  name: string;
  maxPlayers: number;
  players: string[];
  status: "waiting" | "playing";
}

import type { Card } from "./card.js";

export interface Room {
  id: number;
  name: string;
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
  currentPlayerIndex: number;
  trumpCard: Card | null;
  currentTrick: TrickState;
  status: "waiting" | "playing" | "finished";
}