import { BACKEND_HOST } from "./api";

export interface GameSocketMessage {
	type: "connected" | "game_state" | "error" | "player_emote";
	roomId?: number;
	// The player an event is about: who connected, or who emoted.
	username?: string;
	state?: unknown;
	error?: string;
	emote?: string;
}

// WebSocket is selected from the current page protocol so secure deployments
// use wss while local HTTP development uses ws.
export function createGameSocket(
	roomId: number,
	token: string,
): WebSocket {
	const socketProtocol = window.location.protocol === "https:" ? "wss" : "ws";
	const socketUrl = `${socketProtocol}://${BACKEND_HOST}/wizard/games/${roomId}/socket?token=${encodeURIComponent(token)}`;

	return new WebSocket(socketUrl);
}
