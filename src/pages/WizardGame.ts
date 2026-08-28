import { getCurrentUser } from "../services/auth";

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

    renderGame(container, game, user.username, token);
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
    throw new Error(data.error ?? "Could not load game");
  }

  return data;
}

function renderGame(
  container: HTMLElement,
  game: GameState,
  username: string,
  token: string,
): void {
  const currentPlayer = game.players[game.currentPlayerIndex];
  const yourPlayer = game.players.find(
    (player) => player.username === username,
  );

  if (!yourPlayer || !currentPlayer) {
    throw new Error("Could not find player in game");
  }

  const isYourTurn = currentPlayer.username === username;

  container.innerHTML = `
    <main class="page">
      <nav class="navbar">
        <a href="#/home">Home</a>
        <a href="#/lobby">Lobby</a>
        <a href="#/profile">Profile</a>
      </nav>

      <section class="panel">
        <h1>Wizard Game</h1>
        <p>Room: ${game.roomId}</p>
        <p>Round: ${game.currentRound}/${game.totalRounds}</p>
        <p>Phase: ${game.phase}</p>
        <p>Trump: ${formatCard(game.trumpCard)}</p>
        <p>Current turn: ${currentPlayer.username}</p>
      </section>

      <section class="panel">
        <h2>Players</h2>
        <div id="players-list">
          ${game.players
            .map(
              (player) => `
                <p>
                  ${player.username}
                  - cards: ${player.handCount}
                  - prediction: ${formatPrediction(player.prediction)}
                  - tricks: ${player.tricksWon}
                  - score: ${player.score}
                </p>
              `,
            )
            .join("")}
        </div>
      </section>

      <section class="panel">
        <h2>Your hand</h2>
        <div id="hand">
          ${yourPlayer.hand.length === 0
            ? "<p>No cards in hand.</p>"
            : yourPlayer.hand
                .map(
                  (card, index) => `
                    <button
                      type="button"
                      data-card-index="${index}"
                      ${game.phase !== "playing" || !isYourTurn ? "disabled" : ""}
                    >
                      ${formatCard(card)}
                    </button>
                  `,
                )
                .join("")}
        </div>

        <p id="action-message">
          ${isYourTurn ? "It is your turn." : `Waiting for ${currentPlayer.username}.`}
        </p>
      </section>

      ${
        game.phase === "predictions" && isYourTurn
          ? `
            <section class="panel">
              <h2>Your prediction</h2>
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
                <button type="submit">Submit prediction</button>
              </form>
            </section>
          `
          : ""
      }
    </main>
  `;

  const predictionForm =
    document.querySelector<HTMLFormElement>("#prediction-form");

  predictionForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(predictionForm);
    const prediction = Number(formData.get("prediction"));

    await sendAction(
      container,
      game.roomId,
      token,
      "/predictions",
      { prediction },
    );
  });

  container
    .querySelectorAll<HTMLButtonElement>("[data-card-index]")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        const cardIndex = Number(button.dataset.cardIndex);

        await sendAction(
          container,
          game.roomId,
          token,
          "/cards",
          { cardIndex },
        );
      });
    });
}

async function sendAction(
  container: HTMLElement,
  roomId: number,
  token: string,
  actionPath: string,
  body: object,
): Promise<void> {
  try {
    const response = await fetch(
      `${API_BASE}/wizard/games/${roomId}${actionPath}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      },
    );

    const data = (await response.json()) as { error?: string };

    if (!response.ok) {
      throw new Error(data.error ?? "Action failed");
    }

    await renderWizardGamePage(container, roomId);
  } catch (error) {
    const actionMessage =
      document.querySelector<HTMLParagraphElement>("#action-message");

    if (actionMessage) {
      actionMessage.textContent = getErrorMessage(error);
    }
  }
}

function formatCard(card: Card | null): string {
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

function formatPrediction(prediction: number | null): string {
  return prediction === null ? "not submitted" : String(prediction);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "An unexpected error occurred";
}