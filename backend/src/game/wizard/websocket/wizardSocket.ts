import type { FastifyInstance } from "fastify";
import type { WebSocket } from "@fastify/websocket";
import { WizardGameService } from "../services/wizardGameService.js";
import { wizardSessionManager } from "../services/wizardSessionManager.js";
import { WizardGameRunner } from "../services/wizardGameRunner.js";
import { SEER_VALUE, SUITS, THIEF_VALUE, TRICKSTER_VALUE, type Suit } from "../models/card.js";
import { isBotName, seatNameFor } from "../models/bot.js";
import { isEmote } from "../models/emote.js";
import { guestTableEmptied, guestTableJoined } from "../services/guestCleanup.js";
import { withErrorCode } from "../../../errorCodes.js";

interface SocketQuery {
	token?: string;
}

interface SocketMessage {
	type?: string;
	prediction?: number;
	cardIndex?: number;
	suit?: string;
	emote?: string;
	// A Seer or Trickster's power: whose prediction, and what it becomes.
	target?: string;
	// A Thief's swap: the winner's card and the target's, by hand position.
	ownIndex?: number;
	// A test shortcut's card: the rank wanted.
	value?: number;
	// A test shortcut's choice of who a bot's Thief robs.
	mode?: string;
	targetIndex?: number;
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

const HEARTBEAT_MS = 25_000;

const connections = new Map<number, Set<RoomConnection>>();

// Keep WebSocket payload formatting in one place so every event uses the same
// JSON serialization and only sends to open connections.
// An error goes with its code, as from the HTTP routes (errorCodes.ts).
function sendJson(socket: WebSocket, message: unknown): void {
	if (socket.readyState === socket.OPEN) {
		socket.send(JSON.stringify(withErrorCode(message)));
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

// Passes an emote on to the rest of the room. Emotes carry no game state, so
// nothing is saved and no turn is advanced: the sender has already played it
// on their own screen, and everyone else is told who did it.
function broadcastEmote(
	roomId: number,
	from: RoomConnection,
	emote: string,
): void {
	const roomConnections = connections.get(roomId);

	if (!roomConnections) {
		return;
	}

	for (const connection of roomConnections) {
		if (connection === from) {
			continue;
		}

		sendJson(connection.socket, {
			type: "player_emote",
			username: from.username,
			emote,
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

			// Watching an all-NPC game: the host sits (and sees the table) as "<host> NPC".
			const seatName = game && seatNameFor(username, game.players);

			if (!game || !seatName) {
				socket.close(1008, "You are not a player in this game");
				return;
			}

			username = seatName;
			const connection: RoomConnection = { socket, username };
			const roomConnections = connections.get(roomId) ?? new Set();
			roomConnections.add(connection);
			connections.set(roomId, roomConnections);
			guestTableJoined(roomId);

			sendJson(socket, { type: "connected", roomId, username });
			broadcastGameState(roomId, gameService);
			runner.run(roomId).catch((error) => {
				// Not awaited, so a throw in here would otherwise be an unhandled
				// rejection, and Node ends the process for those: one room's failure
				// would end every other game on the server too.
				console.error(`[wizard] runner failed for room ${roomId}:`, error);
			});

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

				// The server plays a watched NPC's moves.
				if (isBotName(username)) {
					sendJson(socket, { type: "error", error: "You are watching this game" });
					return;
				}

				// Not a move: it needs no game, no turn and no saving, so it is
				// handled before anything that assumes a game is running.
				if (message.type === "emote") {
					if (isEmote(message.emote)) {
						broadcastEmote(roomId, connection, message.emote);
					}
					return;
				}

				const currentGame = wizardSessionManager.getGame(roomId);

				if (!currentGame) {
					sendJson(socket, { type: "error", error: "Game not found" });
					return;
				}

				// Not a move: this player's table now shows them their turn, after
				// any walk-in and deal, so its countdown starts now (see the runner).
				if (message.type === "turn_ready") {
					const current = currentGame.players[currentGame.currentPlayerIndex];
					if (
						currentGame.phase !== "finished" &&
						currentGame.turnTimeoutMs !== null &&
						currentGame.turnDeadlineAt === null &&
						current?.username === username
					) {
						currentGame.turnDeadlineAt = Date.now() + currentGame.turnTimeoutMs;
						wizardSessionManager.saveGame(currentGame);
						broadcastGameState(roomId, gameService);
						runner.notifyAction(roomId);
					}
					return;
				}

				// Test shortcut: swaps a card in your hand for a special one at any
				// time, whoever's move it is, and leaves the move's clock alone.
				if (message.type === "dev_give_card" && process.env.WIZARD_DEV_TOOLS) {
					try {
						const wanted: number[] = [0, THIEF_VALUE, TRICKSTER_VALUE, SEER_VALUE, 14];
						if (message.value === undefined || !wanted.includes(message.value)) {
							throw new Error("Invalid card");
						}

						gameService.devGiveCard(
							currentGame,
							username,
							message.value as typeof THIEF_VALUE,
							typeof message.cardIndex === "number" ? message.cardIndex : 0,
						);
						wizardSessionManager.saveGame(currentGame);
						broadcastGameState(roomId, gameService);
					} catch (error) {
						sendJson(socket, {
							type: "error",
							error: error instanceof Error ? error.message : "Could not change the card",
						});
					}
					return;
				}

				// Reject actions submitted after the current decision's deadline.
				if (
					currentGame.turnDeadlineAt !== null &&
					Date.now() >= currentGame.turnDeadlineAt
				) {
					sendJson(socket, {
						type: "error",
						error: "Time is up. The game will make the decision for you.",
					});
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
					} else if (message.type === "skip_power") {
						gameService.skipPower(currentGame, username);
					} else if (message.type === "dev_bot_thief" && process.env.WIZARD_DEV_TOOLS) {
						gameService.devBotThief(
							currentGame,
							username,
							message.mode === "other" ? "other" : "me",
						);
					} else if (message.type === "choose_thief_target") {
						if (typeof message.target !== "string") {
							throw new Error("Invalid target");
						}

						gameService.chooseThiefTarget(currentGame, username, message.target);
					} else if (message.type === "steal_card") {
						if (
							typeof message.ownIndex !== "number" ||
							typeof message.targetIndex !== "number"
						) {
							throw new Error("Invalid card index");
						}

						gameService.stealCard(currentGame, username, {
							ownIndex: message.ownIndex,
							targetIndex: message.targetIndex,
						});
					} else if (message.type === "use_power") {
						if (
							typeof message.prediction !== "number" ||
							!Number.isInteger(message.prediction) ||
							message.prediction < 0
						) {
							throw new Error("Invalid prediction");
						}

						gameService.usePower(currentGame, username, {
							target: typeof message.target === "string" ? message.target : null,
							prediction: message.prediction,
						});
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

					// The human has completed this decision.
					// The runner will start a fresh deadline for the next human decision.
					currentGame.turnDeadlineAt = null;

					wizardSessionManager.saveGame(currentGame);
					broadcastGameState(roomId, gameService);
					runner.notifyAction(roomId);

					runner.run(roomId).catch((error) => {
						console.error(`[wizard] runner failed for room ${roomId}:`, error);
					});

				} catch (error) {
					sendJson(socket, {
						type: "error",
						error: error instanceof Error ? error.message : "Action failed",
					});
				}
			});

			// A browser that stalls or loses its network never sends a close, so
			// the connection would linger. Pinging also keeps proxies from idling
			// the socket out; browsers answer pings on their own.
			let alive = true;
			socket.on("pong", () => {
				alive = true;
			});
			const heartbeat = setInterval(() => {
				if (!alive) {
					socket.terminate();
					return;
				}
				alive = false;
				socket.ping();
			}, HEARTBEAT_MS);

			socket.on("error", () => {
				socket.terminate();
			});

			socket.on("close", () => {
				clearInterval(heartbeat);
				removeConnection(roomId, connection);

				if (!connections.has(roomId)) {
					guestTableEmptied(roomId);
				}
			});
		},
	);
	return runner;
}