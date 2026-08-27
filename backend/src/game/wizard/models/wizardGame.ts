export interface Room {
  id: string;
  name: string;
  maxPlayers: number;
  players: string[];
  status: "waiting" | "playing";
}