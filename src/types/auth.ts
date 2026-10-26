import type { Suit } from "../../backend/src/game/wizard/models/card";

export interface User {
  id: number;
  username: string;
  displayName: string;
  email: string;
}

export interface LoginResponse {
  token: string;
}

export interface RegistrationResponse {
  token: string;
  user: {
    id: number;
    username: string;
  };
}

export interface PlayerStats {
  gamesPlayed: number;
  gamesFinished: number;
  gamesWon: number;
  fullGamesFinished: number;
  fullGamesWon: number;
  totalPoints: number;
  peakTotalPoints: number;
  bestGameScore: number | null;
  tricksWon: number;
  predictionsMade: number;
  exactPredictions: number;
  gamesCreated: number;
  gamesCreatedFinished: number;
  // See backend strongColor.ts. Null only for a player from before it existed.
  strongColor: Suit | null;
  colorPoints: Record<Suit, number>;
}

export interface PlayerOpponent {
  playerId: number;
  opponentType: "user" | "bot";
  opponentId: number | null;
  opponentName: string;
  gamesPlayed: number;
  lastPlayedAt: string;
}