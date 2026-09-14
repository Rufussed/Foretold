import { API_BASE } from "../services/api";
import { getCurrentUser, getToken } from "../services/auth";
import { createGameSocket, type GameSocketMessage } from "../services/gameSocket";
import type { PublicWizardGameState } from "../../backend/src/game/wizard/models/wizardGame";
import { createAiEmotes } from "../visualizer/ai-emotes";
import { createEmoteTrigger, type EmoteTrigger } from "../visualizer/emote-trigger";
import type { GameConnection } from "../visualizer/game-connection";
import { createCardTable, type CardTable } from "../visualizer/card-table";
import { EMOTE_NAMES, SEAT_IDS, type Emote } from "../visualizer/player-characters";
import { createPredictionPrompt, type PredictionPrompt } from "../visualizer/prediction-prompt";
import { characterForUsername, isCharacterId } from "../visualizer/seat-mapping";
import { createSeatSync, type SeatSync } from "../visualizer/seat-sync";
import { createSelfPortrait, type SelfPortrait } from "../visualizer/self-portrait";
import { createWizardScene, type WizardSceneHandle } from "../visualizer/three-scene";

const EMOTE_LABELS: Record<Emote, string> = {
  laugh: "Laugh",
  disbelief: "Disbelief",
  disapproval: "Disapproval",
  thumbsUp: "Thumbs up",
};

// The backend names bots "bot-1", "bot-2", ... when a game starts.
const isBot = (username: string): boolean => username.startsWith("bot-");

let teardown: (() => void) | null = null;

// The router swaps container.innerHTML on navigation, which would otherwise
// leak the previous three.js renderer (its animation loop keeps running
// independent of the DOM) and the game socket. Tear both down first.
export function destroyVisualizer(): void {
  teardown?.();
  teardown = null;
}

export async function renderVisualizerPage(
  container: HTMLElement,
  roomId: number,
): Promise<void> {
  destroyVisualizer();

  let destroyed = false;
  let scene: WizardSceneHandle | null = null;
  let socket: WebSocket | null = null;
  let selfPortrait: SelfPortrait | null = null;
  let cardTable: CardTable | null = null;
  let predictionPrompt: PredictionPrompt | null = null;

  teardown = () => {
    destroyed = true;
    cardTable?.dispose();
    predictionPrompt?.dispose();
    socket?.close();
    selfPortrait?.destroy();
    scene?.destroy();
  };

  container.innerHTML = `
    <main class="visualizer-page">
      <div class="visualizer-canvas-wrap">
        <canvas id="wizard-visualizer-canvas"></canvas>
        <div id="wizard-visualizer-loading">Loading scene…</div>
      </div>

      <nav class="visualizer-nav">
        <a href="#/home">Home</a>
        <a href="#/lobby">Lobby</a>
        <a href="#/game/${roomId}">Back to Game</a>
      </nav>

      <div class="visualizer-emotes" id="visualizer-emotes">
        ${EMOTE_NAMES.map(
          (emote) =>
            `<button type="button" data-emote="${emote}">${EMOTE_LABELS[emote]}</button>`,
        ).join("")}
      </div>

      <figure class="visualizer-self" id="visualizer-self" hidden>
        <div class="visualizer-self-view"></div>
        <figcaption class="visualizer-self-name"></figcaption>
      </figure>
    </main>
  `;

  const canvas = container.querySelector<HTMLCanvasElement>(
    "#wizard-visualizer-canvas",
  );
  const loadingEl = container.querySelector<HTMLDivElement>(
    "#wizard-visualizer-loading",
  );
  const emoteBar = container.querySelector<HTMLDivElement>("#visualizer-emotes");

  if (!canvas) {
    throw new Error("Visualizer canvas element was not found");
  }

  // A live game seats its real players. Without one (not started, or not
  // signed in) the demo table is shown, so the scene can still be worked on.
  const token = getToken();
  let localUsername: string | null = null;
  let latestState: PublicWizardGameState | null = null;

  if (token) {
    try {
      localUsername = (await getCurrentUser()).username;
      const response = await fetch(`${API_BASE}/wizard/games/${roomId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        latestState = (await response.json()) as PublicWizardGameState;
      }
    } catch (error) {
      console.warn("[visualizer] no live game, showing the demo table:", error);
    }
  }

  if (destroyed) {
    return;
  }

  const live = latestState !== null && localUsername !== null;
  let seatSync: SeatSync | null = null;
  let trigger: EmoteTrigger | null = null;
  let aiEmotes: { update(deltaSeconds: number): void } | null = null;

  // Your own character, bottom right: the avatar you claimed, or a stand-in
  // picked from your name when there's no game to read it from.
  const updateSelfPortrait = () => {
    if (!selfPortrait || !localUsername) return;
    const avatar = latestState?.players.find(
      (player) => player.username === localUsername,
    )?.avatar;
    selfPortrait.setCharacter(
      isCharacterId(avatar) ? avatar : characterForUsername(localUsername),
    );
  };

  const selfEl = container.querySelector<HTMLElement>("#visualizer-self");
  const selfView = selfEl?.querySelector<HTMLElement>(".visualizer-self-view");
  const selfName = selfEl?.querySelector<HTMLElement>(".visualizer-self-name");

  if (localUsername && selfEl && selfView && selfName) {
    selfName.textContent = localUsername;
    selfEl.hidden = false;
    selfPortrait = createSelfPortrait(selfView);
    updateSelfPortrait();

    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__wizardSelf = selfPortrait;
    }
  }

  // Your side of the live game, shared by everything that reads the game state
  // or sends a move. Null on the demo table.
  const gameConnection: GameConnection | null = live
    ? {
        localUsername: localUsername ?? "",
        state: () => latestState,
        send: (message) => {
          if (socket?.readyState !== WebSocket.OPEN) return false;
          socket.send(JSON.stringify(message));
          return true;
        },
      }
    : null;

  const page = container.querySelector<HTMLElement>(".visualizer-page");
  if (gameConnection && page) {
    predictionPrompt = createPredictionPrompt(page, gameConnection);
  }

  const applyLatestState = () => {
    if (seatSync && latestState && localUsername) {
      seatSync.applyPlayers(latestState.players, localUsername);
    }
    updateSelfPortrait();
    cardTable?.applyState();
    predictionPrompt?.applyState();
  };

  scene = createWizardScene(canvas, {
    demo: !live,
    onLoading: (loading) => {
      loadingEl?.classList.toggle("hidden", !loading);
    },
    onError: (message) => {
      if (loadingEl) {
        loadingEl.textContent = message;
      }
      console.error(message);
    },
    onReady: (players, environment, view) => {
      // Your hand and the current trick; plays go to the game socket.
      cardTable = createCardTable({
        environment,
        view,
        game: gameConnection,
      });
      if (import.meta.env.DEV) {
        (window as unknown as Record<string, unknown>).__wizardCards = cardTable.cards;
      }

      const emoteTrigger = createEmoteTrigger(players, (emote) =>
        selfPortrait?.emote(emote),
      );
      trigger = emoteTrigger;

      if (live) {
        const sync = createSeatSync(players);
        seatSync = sync;
        applyLatestState();
        aiEmotes = createAiEmotes(emoteTrigger, () =>
          sync
            .seated()
            .filter(([, username]) => isBot(username))
            .map(([seat]) => seat),
        );
      } else {
        aiEmotes = createAiEmotes(emoteTrigger, () => SEAT_IDS);
      }
    },
    onUpdate: (deltaSeconds) => {
      cardTable?.update(deltaSeconds);
      aiEmotes?.update(deltaSeconds);
      trigger?.update(deltaSeconds);
    },
  });

  predictionPrompt?.applyState();

  if (live && token) {
    // Snapshots can arrive before the scene is ready; the newest is kept and
    // applied once the characters exist.
    socket = createGameSocket(roomId, token);
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data as string) as GameSocketMessage;

      if (message.type === "game_state" && message.state) {
        latestState = message.state as PublicWizardGameState;
        applyLatestState();
      }

      if (message.type === "error") {
        // Most likely a refused play, e.g. not your turn or a suit you must
        // follow: the card returns to your hand.
        console.warn("[visualizer] server refused:", message.error);
        cardTable?.refused();
        predictionPrompt?.refused(message.error ?? "The server refused that.");
      }
    });
  }

  emoteBar?.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "[data-emote]",
    );

    if (!button || !trigger) {
      return;
    }

    const emote = button.dataset.emote as Emote;
    trigger.request({ target: "self", emote, source: "local" });
  });
}
