import type { AvatarId } from "./avatar.js";
import type { Card, Suit } from "./card.js";

// A room member and the avatar they claimed, if any, while the room waits.
export interface RoomPlayer {
  username: string;
  avatar: AvatarId | null;
}

// A lobby room exists before a game starts and keeps the player list used to
// initialize the game state.
export interface Room {
  id: number;
  name: string;
  createdBy: number;
  maxPlayers: number;
  players: RoomPlayer[];
  status: "waiting" | "playing";
}

export interface GamePlayer {
  username: string;
  avatar: AvatarId;
  hand: Card[];
  prediction: number | null;
  tricksWon: number;
  score: number;
  roundScores: RoundScore[];
}

// A played card retains its owner so the rules service can return a username
// rather than exposing internal player-array indexes.
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

// This is the client-safe projection of WizardGameState. Other players' cards
// are omitted while hand sizes remain available to render the game UI.
export interface PublicGamePlayer {
  username: string;
  avatar: AvatarId;
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