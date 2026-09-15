import { getCurrentUser } from "../services/auth";
import { API_BASE } from "../services/api";
import type { Suit } from "../../backend/src/game/wizard/models/card";
import {
  createGameSocket,
  type GameSocketMessage,
} from "../services/gameSocket";


interface Card {
  value: number;
  suit: string;
}

interface GamePlayer {
  username: string;
  hand: Card[];
  handCount: number;
  prediction: number | null;
  tricksWon: number;
  score: number;
  roundScores: RoundScore[];
}

interface RoundScore {
  prediction: number;
  tricksWon: number;
  score: number;
}

interface PlayedCard {
  username: string;
  card: Card;
}

interface GameState {
  roomId: number;
  players: GamePlayer[];
  currentRound: number;
  totalRounds: number;
  currentPlayerIndex: number;
  trumpCard: Card | null;
  trumpSuit: Suit | null;
  currentTrick: {
    playedCards: PlayedCard[];
    winnerUsername: string | null;
  };
  status: "waiting" | "playing" | "finished";
  phase:
  | "trump-selection"
  | "predictions"
  | "playing"
  | "finished";
  deckCount: number;
}

interface DebugEvent {
  id: number;
  time: string;
  type: "STATE" | "ACTION" | "ERROR" | "SOCKET";
  message: string;
}

const debugEvents: DebugEvent[] = [];
let debugEventId = 0;

const MAX_DEBUG_EVENTS = 250;

function recordDebugEvent(
  type: DebugEvent["type"],
  message: string,
): void {
  debugEvents.push({
    id: ++debugEventId,
    time: new Date().toLocaleTimeString(),
    type,
    message,
  });

  if (debugEvents.length > MAX_DEBUG_EVENTS) {
    debugEvents.shift();
  }
}

function formatDebugState(game: GameState): string {
  const completedTricks = game.players.reduce(
    (total, player) => total + player.tricksWon,
    0,
  );

  const playedThisTrick = game.currentTrick.playedCards.length;

  const expectedCards =
    game.players.length * game.currentRound;

  const remainingHandCards = game.players.reduce(
    (total, player) => total + player.handCount,
    0,
  );

  const completedTrickCards =
    completedTricks * game.players.length;

  const currentTrickCards =
    playedThisTrick === game.players.length
      ? 0
      : playedThisTrick;

  const accountedCards =
    remainingHandCards +
    currentTrickCards +
    completedTrickCards;

  const overallInvariant =
    accountedCards === expectedCards;

  const playerChecks = game.players.map((player) => {
    const playedCurrentTrick =
      game.currentTrick.playedCards.some(
        (played) => played.username === player.username,
      );

  const completedTricksForPlayer =
    completedTricks;

  const currentTrickContribution =
    playedThisTrick === game.players.length
      ? 0
      : playedCurrentTrick
        ? 1
        : 0;

  const accountedForPlayer =
    player.handCount +
    completedTricksForPlayer +
    currentTrickContribution;

    const expectedForPlayer = game.currentRound;

    const valid =
      accountedForPlayer === expectedForPlayer;

    return (
      `${player.username}: ` +
      `hand=${player.handCount}, ` +
      `completed=${completedTricks}, ` +
      `current=${playedCurrentTrick ? 1 : 0}, ` +
      `total=${accountedForPlayer}/${expectedForPlayer}` +
      `${valid ? " OK" : " *** FAIL ***"}`
    );
  });

  const trickCards = game.currentTrick.playedCards
    .map(
      (played) =>
        `${played.username}=${formatCard(played.card)}`,
    )
    .join(", ");

  return [
    `R${game.currentRound}/${game.totalRounds}`,
    `phase=${game.phase}`,
    `turn=${game.players[game.currentPlayerIndex]?.username ?? "UNKNOWN"}`,
    `hands=[${game.players
      .map(
        (player) =>
          `${player.username}:${player.handCount}`,
      )
      .join(", ")}]`,
    `trick=${playedThisTrick}/${game.players.length}`,
    `completedTricks=${completedTricks}`,
    `trickCards=[${trickCards || "none"}]`,
    `cards=${accountedCards}/${expectedCards}` +
      ` ${overallInvariant ? "OK" : "*** INVARIANT FAIL ***"}`,
    ...playerChecks,
  ].join(" | ");
}

function recordGameState(game: GameState): void {
  recordDebugEvent(
    "STATE",
    formatDebugState(game),
  );
}

function formatDebugEvents(): string {
  if (debugEvents.length === 0) {
    return "No debugger events yet.";
  }

  return debugEvents
    .map(
      (event) =>
        `#${event.id} [${event.time}] ` +
        `[${event.type}] ${event.message}`,
    )
    .join("\n");
}

// The page's game socket, and a count of page mounts. Leaving the page closes
// the socket; otherwise every later game update would redraw this view over
// whatever page is now showing (such as the 3D view). The count stops a load
// that finishes after you've left from opening a socket or drawing.
let activeSocket: WebSocket | null = null;
let mountCount = 0;

export function destroyWizardGamePage(): void {
  mountCount += 1;
  activeSocket?.close();
  activeSocket = null;
}

export async function renderWizardGamePage(
  container: HTMLElement,
  roomId: number,
): Promise<void> {
  destroyWizardGamePage();
  const mount = mountCount;
  const token = localStorage.getItem("wizardToken");

  if (!token) {
    window.location.hash = "#/home";
    return;
  }

  try {
    const user = await getCurrentUser();
    const game = await loadGame(roomId, token);
    
    recordDebugEvent(
      "SOCKET",
      `Initial HTTP game state loaded for room ${roomId}`,
    );

    recordGameState(game);

    if (mount !== mountCount) {
      return;
    }

    const socket = createGameSocket(roomId, token);
    activeSocket = socket;

    socket.addEventListener("message", (event) => {
      if (mount !== mountCount) {
        return;
      }

      const message = JSON.parse(
        event.data as string,
      ) as GameSocketMessage;

      if (message.type === "connected") {
        recordDebugEvent(
          "SOCKET",
          `WebSocket connected to room ${roomId}`,
        );
      }

      if (message.type === "game_state" && message.state) {
        const gameState = message.state as GameState;

        recordGameState(gameState);

        renderGame(
          container,
          gameState,
          user.username,
          socket,
        );
      }

      if (message.type === "error") {
        recordDebugEvent(
          "ERROR",
          message.error ?? "Action failed",
        );

        const actionMessage =
          document.querySelector<HTMLParagraphElement>(
            "#action-message",
          );

        if (actionMessage) {
          actionMessage.textContent =
            message.error ?? "Action failed";
        }
      }
    });

    renderGame(
      container,
      game,
      user.username,
      socket,
    );
  } catch (error) {
    if (mount !== mountCount) {
      return;
    }

    container.innerHTML = `
      <main class="page">
        <section class="panel">
          <h1>Game error</h1>
          <p>${getErrorMessage(error)}</p>
          <a href="#/lobby">Back to Lobby</a>
        </section>
      </main>
    `;
  }
}

async function loadGame(
  roomId: number,
  token: string,
): Promise<GameState> {
  const response = await fetch(
    `${API_BASE}/wizard/games/${roomId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  const data = (await response.json()) as GameState & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(
      data.error ?? "Could not load game",
    );
  }

  return data;
}

function renderGame(
  container: HTMLElement,
  game: GameState,
  username: string,
  socket: WebSocket,
): void {
  const currentPlayer =
    game.players[game.currentPlayerIndex];

  const yourPlayer = game.players.find(
    (player) => player.username === username,
  );

  if (!yourPlayer || !currentPlayer) {
    throw new Error(
      "Could not find player in game",
    );
  }

  const isTrickComplete =
    game.phase === "playing" &&
    game.currentTrick.playedCards.length ===
      game.players.length;

  const isYourTurn =
    currentPlayer.username === username &&
    !isTrickComplete;

  const predictionsSubmitted =
    game.players.filter(
      (player) => player.prediction !== null,
    ).length;

  const allPredictionsSubmitted =
    predictionsSubmitted === game.players.length;

  const phaseLabel =
    game.phase === "trump-selection"
      ? "Choose Trump"
      : game.phase === "predictions"
        ? "Predictions"
        : game.phase === "playing"
          ? "Playing"
          : "Finished";

  const phaseDescription =
    game.phase === "trump-selection"
      ? `${currentPlayer.username} must choose the trump suit`
      : game.phase === "predictions"
        ? `${predictionsSubmitted} / ${game.players.length} predictions submitted`
        : game.phase === "playing"
          ? "Cards are being played"
          : "Game finished";

  container.innerHTML = `
    <main class="page">

      <nav class="navbar game-nav">
        <a href="#/home">Home</a>
        <a href="#/lobby">Lobby</a>
        <a href="#/profile">Profile</a>
        <a class="game-nav-visualizer" href="#/game/${game.roomId}/visualizer">Back to 3D Visualizer</a>
      </nav>

      <!-- GAME HEADER -->
      <section class="panel">
        <div class="game-header">

          <div>
            <p class="game-label">WIZARD GAME</p>
            <h1>
              Round ${game.currentRound}
              <span>/ ${game.totalRounds}</span>
            </h1>
          </div>

          <div class="game-meta">
            <p>Room ${game.roomId}</p>
            <p>Deck: ${game.deckCount} cards</p>
          </div>

        </div>

        <div class="game-status">

          <div class="status-box">
            <span class="status-label">PHASE</span>
            <strong>${phaseLabel}</strong>
          </div>

          <div class="status-box">
            <span class="status-label">CURRENT TURN</span>
            <strong>${currentPlayer.username}</strong>
          </div>

          <div class="status-box">
            <span class="status-label">TRUMP</span>
            <strong>${formatCard(game.trumpCard)}
                    <div class="trump-suit">
                      Trump Suit: ${game.trumpSuit ?? "None"}</div>
            </strong>
          </div>

        </div>
      </section>

      <!-- SEAT ORDER -->
      <section class="panel">

        <div class="section-heading">
          <div>
            <h2>Seat Order</h2>
            <p>
              Player order around the table
            </p>
          </div>
        </div>

        <div class="seat-order">
          ${game.players
            .map((player, index) => {
              const isCurrent =
                index === game.currentPlayerIndex;

              const isYou =
                player.username === username;

              return `
                <div
                  class="seat ${
                    isCurrent ? "seat-current" : ""
                  }"
                >
                  <span class="seat-number">
                    ${index + 1}
                  </span>

                  <span class="seat-name">
                    ${player.username}
                    ${isYou ? " (You)" : ""}
                  </span>

                  ${
                    isCurrent
                      ? `<span class="seat-indicator">
                           CURRENT
                         </span>`
                      : ""
                  }
                </div>
              `;
            })
            .join("")}
        </div>

      </section>

      <!-- PREDICTIONS -->
      <section class="panel">

        <div class="section-heading">
          <div>
            <h2>Predictions</h2>
            <p>${phaseDescription}</p>
          </div>

          <strong>
            ${predictionsSubmitted}
            /
            ${game.players.length}
          </strong>
        </div>

        <div class="prediction-list">

          ${game.players
            .map((player, index) => {
              const hasPredicted =
                player.prediction !== null;

              const isCurrent =
                index === game.currentPlayerIndex;

              return `
                <div
                  class="prediction-row
                    ${isCurrent ? "prediction-current" : ""}
                    ${hasPredicted ? "prediction-done" : ""}
                  "
                >

                  <div class="prediction-player">

                    <span class="player-number">
                      ${index + 1}
                    </span>

                    <span>
                      ${player.username}
                      ${
                        player.username === username
                          ? " (You)"
                          : ""
                      }
                    </span>

                    ${
                      isCurrent
                        ? `<span class="turn-marker">
                             YOUR TURN
                           </span>`
                        : ""
                    }

                  </div>

                  <div class="prediction-value">

                    ${
                      hasPredicted
                        ? `<span class="prediction-submitted">
                             ✓ ${player.prediction}
                           </span>`
                        : `<span class="prediction-waiting">
                             Waiting...
                           </span>`
                    }

                  </div>

                </div>
              `;
            })
            .join("")}

        </div>

        ${
          allPredictionsSubmitted
            ? `
              <p class="phase-complete">
                ✓ All predictions submitted.
                The trick-taking phase can begin.
              </p>
            `
            : ""
        }
        ${
          game.phase === "trump-selection" &&
          currentPlayer.username === username
            ? `
              <section class="panel action-panel">
                <h2>Choose Trump Suit</h2>
                <p>The turned card is a Jester. Choose the trump suit for this round.</p>

                <div class="trump-suit-buttons">
                  <button type="button" data-trump-suit="Blue">Blue</button>
                  <button type="button" data-trump-suit="Red">Red</button>
                  <button type="button" data-trump-suit="Yellow">Yellow</button>
                  <button type="button" data-trump-suit="Green">Green</button>
                </div>
              </section>
            `
            : ""
        }
      </section>

      <!-- CURRENT TRICK -->
      <section class="panel">

        <div class="section-heading">
          <div>
            <h2>Current Trick</h2>
            <p>
              ${game.currentTrick.playedCards.length}
              /
              ${game.players.length}
              cards played
            </p>
          </div>
        </div>

        <div class="trick-list">

          ${game.players
            .map((player) => {
              const played =
                game.currentTrick.playedCards.find(
                  (play) =>
                    play.username ===
                    player.username,
                );

              return `
                <div class="trick-row">

                  <span class="trick-player">
                    ${player.username}
                  </span>

                  <span class="trick-card">
                    ${
                      played
                        ? formatCard(played.card)
                        : "Waiting..."
                    }
                  </span>

                </div>
              `;
            })
            .join("")}

        </div>

        ${
          game.currentTrick.winnerUsername
            ? `
              <div class="trick-winner">
                Winner:
                <strong>
                  ${game.currentTrick.winnerUsername}
                </strong>
              </div>
            `
            : ""
        }

      </section>

      <!-- PLAYERS -->
      <section class="panel">
        <div class="section-heading">
          <div>
            <h2>Score</h2>
            <p>Round-by-round results</p>
          </div>
        </div>

        <div class="score-table-wrapper">
          <table class="score-table">
            <thead>
              <tr>
                <th>Player</th>
                ${Array.from(
                  { length: game.totalRounds },
                  (_, index) => `<th>R${index + 1}</th>`,
                ).join("")}
                <th>Total</th>
              </tr>
            </thead>

            <tbody>
              ${game.players
                .map(
                  (player) => `
                    <tr>
                      <td>
                        ${player.username}
                        ${player.username === username ? " (You)" : ""}
                      </td>

                      ${Array.from({ length: game.totalRounds }, (_, index) => {
                        const roundScore = player.roundScores[index];

                        if (!roundScore) {
                          return `<td>—</td>`;
                        }

                        return `
                          <td>
                            <div class="round-score">${roundScore.score}</div>
                            <div class="round-result">
                              ${roundScore.prediction} / ${roundScore.tricksWon}
                            </div>
                          </td>
                        `;
                      }).join("")}

                      <td class="total-score">${player.score}</td>
                    </tr>
                  `,
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </section>

      <!-- YOUR HAND -->
      <section class="panel">

        <div class="section-heading">
          <div>
            <h2>Your Hand</h2>
            <p>
              ${yourPlayer.hand.length}
              cards remaining
            </p>
          </div>
        </div>

        <div id="hand" class="hand">

          ${
            yourPlayer.hand.length === 0
              ? "<p>No cards in hand.</p>"
              : yourPlayer.hand
                  .map(
                    (card, index) => `
                      <button
                        type="button"
                        class="card-button"
                        data-card-index="${index}"
                        ${
                          game.phase !== "playing" ||
                          !isYourTurn
                            ? "disabled"
                            : ""
                        }
                      >
                        ${formatCard(card)}
                      </button>
                    `,
                  )
                  .join("")
          }

        </div>

        <p id="action-message" class="action-message">
          ${
            game.phase === "predictions"
              ? isYourTurn
                ? "It is your turn to submit a prediction."
                : `Waiting for ${currentPlayer.username} to submit a prediction.`
              : game.phase === "playing"
                ? isTrickComplete
                  ? "Trick complete. Waiting for the result..."
                  : isYourTurn
                    ? "It is your turn to play a card."
                    : `Waiting for ${currentPlayer.username}.`
                : "The game has finished."
          }
        </p>

      </section>

      <!-- PREDICTION ACTION -->
      ${
        game.phase === "predictions" &&
        isYourTurn &&
        yourPlayer.prediction === null
          ? `
            <section class="panel action-panel">

              <h2>Submit Your Prediction</h2>

              <p>
                How many tricks do you expect
                to win this round?
              </p>

              <form id="prediction-form">

                <label>
                  Tricks

                  <input
                    name="prediction"
                    type="number"
                    min="0"
                    max="${game.currentRound}"
                    required
                  />
                </label>

                <button type="submit">
                  Submit Prediction
                </button>

              </form>

            </section>
          `
          : ""
      }
      <!-- DEBUGGER -->

      <section class="panel">

        <details open>

          <summary>
            <strong>Frontend Debugger</strong>
          </summary>

          <div
            style="
              margin-top: 1rem;
              display: flex;
              justify-content: space-between;
              align-items: center;
              gap: 1rem;
            "
          >

            <span>
              ${debugEvents.length} events
            </span>

            <button
              type="button"
              id="clear-debugger"
            >
              Clear
            </button>

          </div>

          <pre
            id="debug-log"
            style="
              margin-top: 1rem;
              white-space: pre-wrap;
              overflow-x: auto;
              font-size: 0.8rem;
              line-height: 1.5;
              max-height: 500px;
              overflow-y: auto;
            "
          >${formatDebugEvents()}</pre>

        </details>

      </section>
    </main>
  `;

  const clearDebuggerButton =
    document.querySelector<HTMLButtonElement>(
      "#clear-debugger",
    );

  clearDebuggerButton?.addEventListener(
    "click",
    () => {
      debugEvents.length = 0;
      debugEventId = 0;

      recordDebugEvent(
        "SOCKET",
        "Debugger cleared",
      );

      const debugLog =
        document.querySelector<HTMLPreElement>(
          "#debug-log",
        );

      if (debugLog) {
        debugLog.textContent =
          formatDebugEvents();
      }
    },
  );

  const predictionForm =
    document.querySelector<HTMLFormElement>(
      "#prediction-form",
    );

  predictionForm?.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      const formData =
        new FormData(predictionForm);

      const prediction = Number(
        formData.get("prediction"),
      );

      recordDebugEvent(
        "ACTION",
        `USER ${username} -> submit_prediction prediction=${prediction}`,
      );

      sendSocketAction(
        socket,
        "submit_prediction",
        { prediction },
      );
    },
  );

  container
    .querySelectorAll<HTMLButtonElement>(
      "[data-card-index]",
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        async () => {
          const cardIndex = Number(
            button.dataset.cardIndex,
          );

          const card = yourPlayer.hand[cardIndex];

          recordDebugEvent(
            "ACTION",
            `USER ${username} -> play_card ` +
            `index=${cardIndex} ` +
            `card=${card ? formatCard(card) : "UNKNOWN"}`,
          );

          sendSocketAction(
            socket,
            "play_card",
            { cardIndex },
          );
        },
      );
    });

    container
      .querySelectorAll<HTMLButtonElement>("[data-trump-suit]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          const suit = button.dataset.trumpSuit;

          if (!suit) {
            return;
          }

          recordDebugEvent(
            "ACTION",
            `USER ${username} -> choose_trump suit=${suit}`,
          );

          sendSocketAction(
            socket,
            "choose_trump",
            { suit },
          );
        });
      });
}

function sendSocketAction(
  socket: WebSocket,
  type:
    | "submit_prediction"
    | "play_card"
    | "choose_trump",
  payload: {
    prediction?: number;
    cardIndex?: number;
    suit?: string;
  },
): void {
  if (socket.readyState !== WebSocket.OPEN) {
    recordDebugEvent(
      "ERROR",
      `Attempted ${type}, but WebSocket is not open. ` +
      `readyState=${socket.readyState}`,
    );

    const actionMessage =
      document.querySelector<HTMLParagraphElement>(
        "#action-message",
      );

    if (actionMessage) {
      actionMessage.textContent =
        "Game connection is not ready";
    }

    return;
  }

  const message = {
    type,
    ...payload,
  };

  recordDebugEvent(
    "ACTION",
    `SEND ${JSON.stringify(message)}`,
  );

  socket.send(JSON.stringify(message));
}

function formatCard(
  card: Card | null,
): string {
  if (!card) {
    return "None";
  }

  if (card.value === 14) {
    return `Wizard of ${card.suit}`;
  }

  if (card.value === 0) {
    return `Jester of ${card.suit}`;
  }

  return `${card.value} of ${card.suit}`;
}

function getErrorMessage(
  error: unknown,
): string {
  return error instanceof Error
    ? error.message
    : "An unexpected error occurred";
}

