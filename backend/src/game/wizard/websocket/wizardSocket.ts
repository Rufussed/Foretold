import type { FastifyInstance } from "fastify";
import type { WebSocket } from "@fastify/websocket";
import { WizardGameService } from "../services/wizardGameService.js";
import { wizardSessionManager } from "../services/wizardSessionManager.js";
import { WizardGameRunner } from "../services/wizardGameRunner.js";

interface SocketQuery {
	token?: string;
}

interface SocketMessage {
	type?: string;
	prediction?: number;
	cardIndex?: number;
}

interface RoomConnection {
	socket: WebSocket;
	username: string;
}

const connections = new Map<number, Set<RoomConnection>>();

function sendJson(socket: WebSocket, message: unknown): void {
	if (socket.readyState === socket.OPEN) {
		socket.send(JSON.stringify(message));
	}
}

export function broadcastGameState(
	roomId: number,
	gameService: WizardGameService,
): void {
	const game = wizardSessionManager.getGame(roomId);
	const roomConnections = connections.get(roomId);

	if (!game || !roomConnections) {
		return;
	}

	for (const connection of roomConnections) {
		sendJson(connection.socket, {
			type: "game_state",
			state: gameService.getPublicGameState(game, connection.username),
		});
	}
}

function removeConnection(roomId: number, connection: RoomConnection): void {
	const roomConnections = connections.get(roomId);

	if (!roomConnections) {
		return;
	}

	roomConnections.delete(connection);

	if (roomConnections.size === 0) {
		connections.delete(roomId);
	}
}

export function registerWizardSocket(
	server: FastifyInstance,
	gameService: WizardGameService,
): WizardGameRunner {
	const runner = new WizardGameRunner(
		gameService,
		(roomId) => broadcastGameState(roomId, gameService),
	);

	server.get<{ Params: { roomId: string }; Querystring: SocketQuery }>(
		"/games/:roomId/socket",
		{ websocket: true },
		async (socket, request) => {
			const roomId = Number(request.params.roomId);
			const token = request.query.token;

			if (!Number.isInteger(roomId) || !token) {
				socket.close(1008, "Invalid connection details");
				return;
			}

			let username: string;

			try {
				const tokenUser = server.jwt.verify<{ username?: string }>(token);

				if (!tokenUser.username) {
					throw new Error("User identity missing");
				}

				username = tokenUser.username;
			} catch {
				socket.close(1008, "Unauthorized");
				return;
			}

			const game = wizardSessionManager.getGame(roomId);

			if (!game || !game.players.some((player) => player.username === username)) {
				socket.close(1008, "You are not a player in this game");
				return;
			}

			const connection: RoomConnection = { socket, username };
			const roomConnections = connections.get(roomId) ?? new Set();
			roomConnections.add(connection);
			connections.set(roomId, roomConnections);

			sendJson(socket, { type: "connected", roomId, username });
			broadcastGameState(roomId, gameService);

			socket.on("message", (rawMessage: { toString(): string }) => {
				let message: SocketMessage;

				try {
					message = JSON.parse(rawMessage.toString()) as SocketMessage;
				} catch {
					sendJson(socket, { type: "error", error: "Invalid message" });
					return;
				}

				const currentGame = wizardSessionManager.getGame(roomId);

				if (!currentGame) {
					sendJson(socket, { type: "error", error: "Game not found" });
					return;
				}

				try {
					if (message.type === "submit_prediction") {
						gameService.submitPrediction(
							currentGame,
							username,
							Number(message.prediction),
						);
					} else if (message.type === "play_card") {
						const currentPlayer =
							currentGame.players[currentGame.currentPlayerIndex];

						if (!currentPlayer || currentPlayer.username !== username) {
							throw new Error("It is not your turn");
						}

						gameService.playCard(currentGame, Number(message.cardIndex));
					} else {
						throw new Error("Unknown action");
					}

					wizardSessionManager.saveGame(currentGame);
					broadcastGameState(roomId, gameService);

					void runner.run(roomId);

				} catch (error) {
					sendJson(socket, {
						type: "error",
						error: error instanceof Error ? error.message : "Action failed",
					});
				}
			});

			socket.on("close", () => {
				removeConnection(roomId, connection);
			});
		},
	);
	return runner;
}