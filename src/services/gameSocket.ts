export interface GameSocketMessage {
	type: "connected" | "game_state" | "error";
	roomId?: number;
	username?: string;
	state?: unknown;
	error?: string;
}

export function createGameSocket(
	roomId: number,
	token: string,
): WebSocket {
	const socketProtocol = window.location.protocol === "https:" ? "wss" : "ws";
	const socketUrl = `${socketProtocol}://127.0.0.1:3000/wizard/games/${roomId}/socket?token=${encodeURIComponent(token)}`;

	return new WebSocket(socketUrl);
}
