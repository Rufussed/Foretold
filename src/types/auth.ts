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
  id: number;
  username: string;
}

export interface PlayerStats {
  gamesPlayed: number;
  gamesFinished: number;
  gamesWon: number;
  totalPoints: number;
  tricksWon: number;
  predictionsMade: number;
  exactPredictions: number;
  gamesCreated: number;
  gamesCreatedFinished: number;
}