import type { PublicWizardGameState } from "../../backend/src/game/wizard/models/wizardGame";

// The local player's side of a live game, shared by the parts of the
// visualiser that read game state and send moves.
export interface GameConnection {
  localUsername: string;
  state(): PublicWizardGameState | null;
  // Sends a message to the game server; false if it couldn't be sent.
  send(message: object): boolean;
}

// The local player's entry in the current game state, if any.
export function localPlayer(game: GameConnection) {
  return game.state()?.players.find((player) => player.username === game.localUsername);
}

// Whether the game is waiting on the local player right now.
export function isLocalTurn(game: GameConnection): boolean {
  const state = game.state();
  return state?.players[state.currentPlayerIndex]?.username === game.localUsername;
}
