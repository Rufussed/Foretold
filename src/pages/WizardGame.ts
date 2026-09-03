import { getCurrentUser } from "../services/auth";

import {
  createGameSocket,
  type GameSocketMessage,
} from "../services/gameSocket";

const API_BASE = "http://127.0.0.1:3000";

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
  currentTrick: {
    playedCards: PlayedCard[];
    winnerUsername: string | null;
  };
  status: "waiting" | "playing" | "finished";
  phase: "predictions" | "playing" | "finished";
  deckCount: number;
}

export async function renderWizardGamePage(
  container: HTMLElement,
  roomId: number,
): Promise<void> {
  const token = localStorage.getItem("wizardToken");

  if (!token) {
    window.location.hash = "#/home";
    return;
  }

  try {
    const user = await getCurrentUser();
    const game = await loadGame(roomId, token);
    const socket = createGameSocket(roomId, token);

    socket.addEventListener("message", (event) => {
      const message = JSON.parse(
        event.data as string,
      ) as GameSocketMessage;

      if (message.type === "game_state" && message.state) {
        renderGame(
          container,
          message.state as GameState,
          user.username,
          socket,
        );
      }

      if (message.type === "error") {
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

  const isYourTurn =
    currentPlayer.username === username;

  const predictionsSubmitted =
    game.players.filter(
      (player) => player.prediction !== null,
    ).length;

  const allPredictionsSubmitted =
    predictionsSubmitted === game.players.length;

  const phaseLabel =
    game.phase === "predictions"
      ? "Predictions"
      : game.phase === "playing"
        ? "Playing"
        : "Finished";

  const phaseDescription =
    game.phase === "predictions"
      ? `${predictionsSubmitted} / ${game.players.length} predictions submitted`
      : game.phase === "playing"
        ? "Cards are being played"
        : "Game finished";

  container.innerHTML = `
    <main class="page">

      <nav class="navbar">
        <a href="#/home">Home</a>
        <a href="#/lobby">Lobby</a>
        <a href="#/profile">Profile</a>
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
            <strong>${formatCard(game.trumpCard)}</strong>
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
            <h2>Players</h2>
            <p>Game status and score</p>
          </div>
        </div>

        <div class="players-table">

          <div class="players-table-header">
            <span>Player</span>
            <span>Cards</span>
            <span>Prediction</span>
            <span>Tricks</span>
            <span>Score</span>
          </div>

          ${game.players
            .map((player, index) => {
              const isCurrent =
                index === game.currentPlayerIndex;

              return `
                <div
                  class="players-table-row
                    ${isCurrent ? "player-current" : ""}"
                >

                  <span>
                    ${
                      isCurrent
                        ? "▶ "
                        : ""
                    }
                    ${player.username}
                    ${
                      player.username === username
                        ? " (You)"
                        : ""
                    }
                  </span>

                  <span>
                    ${player.handCount}
                  </span>

                  <span>
                    ${formatPrediction(
                      player.prediction,
                    )}
                  </span>

                  <span>
                    ${player.tricksWon}
                  </span>

                  <span>
                    ${player.score}
                  </span>

                </div>
              `;
            })
            .join("")}

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
                ? isYourTurn
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

    </main>
  `;

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

          sendSocketAction(
            socket,
            "play_card",
            { cardIndex },
          );
        },
      );
    });
}

function sendSocketAction(
  socket: WebSocket,
  type:
    | "submit_prediction"
    | "play_card",
  payload: {
    prediction?: number;
    cardIndex?: number;
  },
): void {
  if (socket.readyState !== WebSocket.OPEN) {
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

  socket.send(
    JSON.stringify({
      type,
      ...payload,
    }),
  );
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

function formatPrediction(
  prediction: number | null,
): string {
  return prediction === null
    ? "—"
    : String(prediction);
}

function getErrorMessage(
  error: unknown,
): string {
  return error instanceof Error
    ? error.message
    : "An unexpected error occurred";
}

// import { getCurrentUser } from "../services/auth";
// import {
//   createGameSocket,
//   type GameSocketMessage,
// } from "../services/gameSocket";

// const API_BASE = "http://127.0.0.1:3000";

// interface Card {
//   value: number;
//   suit: string;
// }

// interface GamePlayer {
//   username: string;
//   hand: Card[];
//   handCount: number;
//   prediction: number | null;
//   tricksWon: number;
//   score: number;
// }

// interface PlayedCard {
//   username: string;
//   card: Card;
// }

// interface GameState {
//   roomId: number;
//   players: GamePlayer[];
//   currentRound: number;
//   totalRounds: number;
//   currentPlayerIndex: number;
//   trumpCard: Card | null;
//   currentTrick: {
//     playedCards: PlayedCard[];
//     winnerUsername: string | null;
//   };
//   status: "waiting" | "playing" | "finished";
//   phase: "predictions" | "playing" | "finished";
//   deckCount: number;
// }

// export async function renderWizardGamePage(
//   container: HTMLElement,
//   roomId: number,
// ): Promise<void> {
//   const token = localStorage.getItem("wizardToken");

//   if (!token) {
//     window.location.hash = "#/home";
//     return;
//   }

//   try {
//     const user = await getCurrentUser();
//     const game = await loadGame(roomId, token);

//     const socket = createGameSocket(roomId, token);

//     socket.addEventListener("message", (event) => {
//       const message = JSON.parse(event.data as string) as GameSocketMessage;

//       if (message.type === "game_state" && message.state) {
//         renderGame(
//           container,
//           message.state as GameState,
//           user.username,
//           socket,
//         );
//       }

//       if (message.type === "error") {
//         const actionMessage =
//           document.querySelector<HTMLParagraphElement>("#action-message");

//         if (actionMessage) {
//           actionMessage.textContent = message.error ?? "Action failed";
//         }
//       }
//     });

//     renderGame(container, game, user.username, socket);
//   } catch (error) {
//     container.innerHTML = `
//       <main class="page">
//         <section class="panel">
//           <h1>Game error</h1>
//           <p>${getErrorMessage(error)}</p>
//           <a href="#/lobby">Back to Lobby</a>
//         </section>
//       </main>
//     `;
//   }
// }

// async function loadGame(
//   roomId: number,
//   token: string,
// ): Promise<GameState> {
//   const response = await fetch(
//     `${API_BASE}/wizard/games/${roomId}`,
//     {
//       headers: {
//         Authorization: `Bearer ${token}`,
//       },
//     },
//   );

//   const data = (await response.json()) as GameState & {
//     error?: string;
//   };

//   if (!response.ok) {
//     throw new Error(data.error ?? "Could not load game");
//   }

//   return data;
// }

// function renderGame(
//   container: HTMLElement,
//   game: GameState,
//   username: string,
//   socket: WebSocket,
// ): void {
//   const currentPlayer = game.players[game.currentPlayerIndex];
//   const yourPlayer = game.players.find(
//     (player) => player.username === username,
//   );

//   if (!yourPlayer || !currentPlayer) {
//     throw new Error("Could not find player in game");
//   }

//   const isYourTurn = currentPlayer.username === username;

//   container.innerHTML = `
//     <main class="page">
//       <nav class="navbar">
//         <a href="#/home">Home</a>
//         <a href="#/lobby">Lobby</a>
//         <a href="#/profile">Profile</a>
//       </nav>

//       <section class="panel">
//         <h1>Wizard Game</h1>
//         <p>Room: ${game.roomId}</p>
//         <p>Round: ${game.currentRound}/${game.totalRounds}</p>
//         <p>Phase: ${game.phase}</p>
//         <p>Trump: ${formatCard(game.trumpCard)}</p>
//         <p>Current turn: ${currentPlayer.username}</p>
//       </section>
//       <section class="panel">
//         <h2>Played cards this trick</h2>
//         <div id="played-cards">
//           ${
//             game.currentTrick.playedCards.length === 0
//               ? "<p>No cards played yet.</p>"
//               : game.currentTrick.playedCards
//                   .map(
//                     (play) => `
//                       <p>
//                         ${play.username}: ${formatCard(play.card)}
//                       </p>
//                     `,
//                   )
//                   .join("")
//           }
//         </div>
//       </section>
//       <section class="panel">
//         <h2>Players</h2>
//         <div id="players-list">
//           ${game.players
//             .map(
//               (player) => `
//                 <p>
//                   ${player.username}
//                   - cards: ${player.handCount}
//                   - prediction: ${formatPrediction(player.prediction)}
//                   - tricks: ${player.tricksWon}
//                   - score: ${player.score}
//                 </p>
//               `,
//             )
//             .join("")}
//         </div>
//       </section>

//       <section class="panel">
//         <h2>Your hand</h2>
//         <div id="hand">
//           ${yourPlayer.hand.length === 0
//             ? "<p>No cards in hand.</p>"
//             : yourPlayer.hand
//                 .map(
//                   (card, index) => `
//                     <button
//                       type="button"
//                       data-card-index="${index}"
//                       ${game.phase !== "playing" || !isYourTurn ? "disabled" : ""}
//                     >
//                       ${formatCard(card)}
//                     </button>
//                   `,
//                 )
//                 .join("")}
//         </div>

//         <p id="action-message">
//           ${isYourTurn ? "It is your turn." : `Waiting for ${currentPlayer.username}.`}
//         </p>
//       </section>

//       ${
//         game.phase === "predictions" && isYourTurn
//           ? `
//             <section class="panel">
//               <h2>Your prediction</h2>
//               <form id="prediction-form">
//                 <label>
//                   Tricks
//                   <input
//                     name="prediction"
//                     type="number"
//                     min="0"
//                     max="${game.currentRound}"
//                     required
//                   />
//                 </label>
//                 <button type="submit">Submit prediction</button>
//               </form>
//             </section>
//           `
//           : ""
//       }
//     </main>
//   `;

//   const predictionForm =
//     document.querySelector<HTMLFormElement>("#prediction-form");

//   predictionForm?.addEventListener("submit", async (event) => {
//     event.preventDefault();

//     const formData = new FormData(predictionForm);
//     const prediction = Number(formData.get("prediction"));

//     sendSocketAction(socket, "submit_prediction", { prediction });
//   });

//   container
//     .querySelectorAll<HTMLButtonElement>("[data-card-index]")
//     .forEach((button) => {
//       button.addEventListener("click", async () => {
//         const cardIndex = Number(button.dataset.cardIndex);

//         sendSocketAction(socket, "play_card", { cardIndex });
//       });
//     });
// }

// function sendSocketAction(
//   socket: WebSocket,
//   type: "submit_prediction" | "play_card",
//   payload: { prediction?: number; cardIndex?: number },
// ): void {
//   if (socket.readyState !== WebSocket.OPEN) {
//     const actionMessage =
//       document.querySelector<HTMLParagraphElement>("#action-message");

//     if (actionMessage) {
//       actionMessage.textContent = "Game connection is not ready";
//     }

//     return;
//   }

//   socket.send(JSON.stringify({ type, ...payload }));
// }

// function formatCard(card: Card | null): string {
//   if (!card) {
//     return "None";
//   }

//   if (card.value === 14) {
//     return `Wizard of ${card.suit}`;
//   }

//   if (card.value === 0) {
//     return `Jester of ${card.suit}`;
//   }

//   return `${card.value} of ${card.suit}`;
// }

// function formatPrediction(prediction: number | null): string {
//   return prediction === null ? "not submitted" : String(prediction);
// }

// function getErrorMessage(error: unknown): string {
//   return error instanceof Error
//     ? error.message
//     : "An unexpected error occurred";
// }