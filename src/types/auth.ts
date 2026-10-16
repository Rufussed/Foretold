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
  tricksWon: number;
  predictionsMade: number;
  exactPredictions: number;
  gamesCreated: number;
  gamesCreatedFinished: number;
}

export interface PlayerOpponent {
  playerId: number;
  opponentType: "user" | "bot";
  opponentId: number | null;
  opponentName: string;
  gamesPlayed: number;
}