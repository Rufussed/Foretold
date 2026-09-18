import type { FastifyInstance } from "fastify";
import type { WebSocket } from "@fastify/websocket";
import { WizardGameService } from "../services/wizardGameService.js";
import { wizardSessionManager } from "../services/wizardSessionManager.js";
import { WizardGameRunner } from "../services/wizardGameRunner.js";
import { SUITS, type Suit } from "../models/card.js";

interface SocketQuery {
	token?: string;
}

interface SocketMessage {
	type?: string;
	prediction?: number;
	cardIndex?: number;
	suit?: string;
}

function isSuit(value: unknown): value is Suit {
  return (
    typeof value === "string" &&
    (SUITS as readonly string[]).includes(value)
  );
}

interface RoomConnection {
	socket: WebSocket;
	username: string;
}

const connections = new Map<number, Set<RoomConnection>>();

// Keep WebSocket payload formatting in one place so every event uses the same
// JSON serialization and only sends to open connections.
function sendJson(socket: WebSocket, message: unknown): void {
	if (socket.readyState === socket.OPEN) {
		socket.send(JSON.stringify(message));
	}
}

export function broadcastGameState(
	roomId: number,
	gameService: WizardGameService,
): void {
	// Each player receives a personalized public state because hand visibility
	// depends on the username attached to that connection.
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
	// The runner is shared by all connections in a room; it serializes bot and
	// human-driven state transitions through the session manager.
	const runner = new WizardGameRunner(
		gameService,
		(roomId) => broadcastGameState(roomId, gameService),
	);

	server.get<{ Params: { roomId: string }; Querystring: SocketQuery }>(
		"/games/:roomId/socket",
		{ websocket: true },
		async (socket, request) => {
			// Authenticate the token before registering the socket or exposing state.
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
			void runner.run(roomId);

			socket.on("message", (rawMessage: { toString(): string }) => {
				// Parse and validate each action against the current game state. The
				// service remains responsible for enforcing game rules and turn order.
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
						if (
							typeof message.prediction !== "number" ||
							!Number.isInteger(message.prediction) ||
							message.prediction < 0
						) {
							throw new Error("Invalid prediction");
						}

						gameService.submitPrediction(
							currentGame,
							username,
							message.prediction,
						);
					} else if (message.type === "play_card") {
						if (
							typeof message.cardIndex !== "number" ||
							!Number.isInteger(message.cardIndex) ||
							message.cardIndex < 0
						) {
							throw new Error("Invalid card index");
						}

						const currentPlayer =
							currentGame.players[currentGame.currentPlayerIndex];

						if (!currentPlayer || currentPlayer.username !== username) {
							throw new Error("It is not your turn");
						}

						gameService.playCard(currentGame, message.cardIndex);
					} else if (message.type === "choose_trump") {
						if (!isSuit(message.suit)) {
							throw new Error("Invalid suit");
						}

						gameService.chooseTrumpSuit(
							currentGame,
							username,
							message.suit,
						);
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