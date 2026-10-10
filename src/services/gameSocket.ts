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

export interface GameConnectionHandle {
	// False when the socket is not open, so the caller can tell the move was lost.
	send(message: unknown): boolean;
	close(): void;
}

const RETRY_DELAYS_MS = [500, 1000, 2000, 4000, 8000];
// A connection attempt that has neither opened nor failed by now is stuck, as
// happens behind a proxy that takes the request and never answers.
const CONNECT_TIMEOUT_MS = 10_000;

// A game socket that opens again after it drops. The server sends the full
// state on every connect, so nothing else needs replaying.
export function connectGameSocket(
	roomId: number,
	token: string,
	handlers: {
		onMessage(message: GameSocketMessage): void;
		// refused: the server will not let this player in, so retrying is pointless.
		onStatus(online: boolean, refused?: boolean): void;
	},
): GameConnectionHandle {
	let socket: WebSocket | null = null;
	let retry = 0;
	let timer: number | undefined;
	let closed = false;

	const open = () => {
		const current = createGameSocket(roomId, token);
		socket = current;

		const connectTimer = window.setTimeout(() => {
			if (current.readyState === WebSocket.CONNECTING) current.close();
		}, CONNECT_TIMEOUT_MS);

		current.addEventListener("open", () => {
			window.clearTimeout(connectTimer);
			if (retry > 0) console.info(`[socket] reconnected after ${retry} ${retry === 1 ? "try" : "tries"}`);
			retry = 0;
			handlers.onStatus(true);
		});
		current.addEventListener("message", (event) => {
			handlers.onMessage(JSON.parse(event.data as string) as GameSocketMessage);
		});
		current.addEventListener("close", (event) => {
			window.clearTimeout(connectTimer);
			if (closed || socket !== current) return;
			console.warn(
				`[socket] closed (code ${event.code}${event.reason ? `, ${event.reason}` : ""}, clean ${event.wasClean}); retry ${retry + 1}`,
			);
			// 1008 means the server refused us (bad token, not in the game).
			if (event.code === 1008) {
				handlers.onStatus(false, true);
				return;
			}
			handlers.onStatus(false);
			const delay = RETRY_DELAYS_MS[Math.min(retry, RETRY_DELAYS_MS.length - 1)];
			retry += 1;
			timer = window.setTimeout(open, delay);
		});
	};

	// A tab coming back from the background, or the network returning, should
	// not wait out the backoff.
	const retryNow = () => {
		if (closed || (socket && socket.readyState <= WebSocket.OPEN)) return;
		window.clearTimeout(timer);
		open();
	};
	window.addEventListener("online", retryNow);
	const onVisible = () => {
		if (!document.hidden) retryNow();
	};
	document.addEventListener("visibilitychange", onVisible);

	open();

	return {
		send(message) {
			if (socket?.readyState !== WebSocket.OPEN) return false;
			socket.send(JSON.stringify(message));
			return true;
		},
		close() {
			closed = true;
			window.clearTimeout(timer);
			window.removeEventListener("online", retryNow);
			document.removeEventListener("visibilitychange", onVisible);
			socket?.close();
		},
	};
}
