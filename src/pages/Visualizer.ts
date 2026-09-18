import { API_BASE } from "../services/api";
import { getCurrentUser, getToken } from "../services/auth";
import { createGameSocket, type GameSocketMessage } from "../services/gameSocket";
import type { PublicWizardGameState } from "../../backend/src/game/wizard/models/wizardGame";
import { isBotName, seatNameFor } from "../../backend/src/game/wizard/models/bot";
import { createAiEmotes } from "../visualizer/ai-emotes";
import { createBackgroundMusic, type BackgroundMusic } from "../visualizer/background-music";
import { createMusicToggle, type MusicToggle } from "../visualizer/music-toggle";
import { createEmoteTrigger, type EmoteTrigger } from "../visualizer/emote-trigger";
import type { GameConnection } from "../visualizer/game-connection";
import { createGameHud, type GameHud } from "../visualizer/hud/game-hud";
import { useHeadshotRenderer } from "../visualizer/hud/headshots";
import { createCardTable, type CardTable } from "../visualizer/card-table";
import { createDiagnostics, type Diagnostics } from "../visualizer/diagnostics";
import { EMOTE_NAMES, SEAT_IDS, type Emote } from "../visualizer/player-characters";
import { createTableDirector, type TableDirector } from "../visualizer/table-director";
import { createPredictionPrompt, type PredictionPrompt } from "../visualizer/prediction-prompt";
import { createTrumpPrompt, type TrumpPrompt } from "../visualizer/trump-prompt";
import { characterForUsername, isCharacterId } from "../visualizer/seat-mapping";
import { createSeatSync, type SeatSync } from "../visualizer/seat-sync";
import { createSelfPortrait, type SelfPortrait } from "../visualizer/self-portrait";
import { createTableLayout } from "../visualizer/table-layout";
import { createTurnCamera, type TurnCamera } from "../visualizer/turn-camera";
import { createWizardScene, type WizardSceneHandle } from "../visualizer/three-scene";

// Each emote button shows an emoji; the name is its tooltip and accessible label.
const EMOTE_BUTTONS: Record<Emote, { emoji: string; name: string }> = {
  laugh: { emoji: "😂", name: "Laugh" },
  disbelief: { emoji: "😲", name: "Disbelief" },
  disapproval: { emoji: "👎", name: "Disapproval" },
  thumbsUp: { emoji: "👍", name: "Thumbs up" },
};


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
  let trumpPrompt: TrumpPrompt | null = null;
  let gameHud: GameHud | null = null;
  let tableDirector: TableDirector | null = null;
  let diagnostics: Diagnostics | null = null;
  let music: BackgroundMusic | null = null;
  let musicToggle: MusicToggle | null = null;

  teardown = () => {
    destroyed = true;
    musicToggle?.dispose();
    music?.dispose();
    useHeadshotRenderer(null);
    diagnostics?.dispose();
    cardTable?.dispose();
    tableDirector?.dispose();
    predictionPrompt?.dispose();
    trumpPrompt?.dispose();
    gameHud?.dispose();
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
        <a href="#/game/${roomId}">Technical View</a>
      </nav>

      <div class="visualizer-emotes" id="visualizer-emotes">
        ${EMOTE_NAMES.map(
          (emote) =>
            `<button type="button" data-emote="${emote}" title="${EMOTE_BUTTONS[emote].name}" aria-label="${EMOTE_BUTTONS[emote].name}">${EMOTE_BUTTONS[emote].emoji}</button>`,
        ).join("")}
      </div>

      <figure class="visualizer-self" id="visualizer-self" hidden>
        <div class="visualizer-self-view"></div>
        <figcaption class="visualizer-self-name"></figcaption>
      </figure>
    </main>
  `;

  // The ambient track loops while this view is open, with a mute button over
  // the score panel's corner.
  const pageEl = container.querySelector<HTMLElement>(".visualizer-page");
  if (pageEl) {
    music = createBackgroundMusic();
    musicToggle = createMusicToggle(pageEl, music);
  }

  const canvas = container.querySelector<HTMLCanvasElement>(
    "#wizard-visualizer-canvas",
  );
  const loadingEl = container.querySelector<HTMLDivElement>(
    "#wizard-visualizer-loading",
  );
  const emoteBar = container.querySelector<HTMLDivElement>("#visualizer-emotes");

  // Dev builds: a trail of what the 3D view did, shown on screen after a crash,
  // a script error or a lost graphics context (see diagnostics.ts).
  if (import.meta.env.DEV) {
    diagnostics = createDiagnostics(container.querySelector<HTMLElement>(".visualizer-page") ?? container);
  }

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
        // An all-NPC game: you watch from your own NPC's seat.
        localUsername = seatNameFor(localUsername, latestState.players) ?? localUsername;
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
  let turnCamera: TurnCamera | null = null;

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
    diagnostics?.note("portrait view created");
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

  // Plays each server snapshot out as a chain of steps (camera turns,
  // announcements, the trick reward, the deal), each starting when the one
  // before is done; see table-director.ts. The card table and the HUD follow
  // what it has shown so far.
  const director = createTableDirector({
    initial: null,
    localUsername: localUsername ?? "",
    applyTable: () => cardTable?.applyState(),
    applyHud: () => {
      predictionPrompt?.applyState();
      trumpPrompt?.applyState();
      gameHud?.applyState();
    },
    dealing: () => cardTable?.dealing ?? false,
    lookAt: (username, done) => (turnCamera ? turnCamera.lookAt(username, done) : done()),
    whenAnnouncerIdle: (done) => (gameHud ? gameHud.whenIdle(done) : done()),
    playTrickReward: (done) => (cardTable ? cardTable.playTrickReward(done) : done()),
  });
  tableDirector = director;
  const tableConnection: GameConnection | null = gameConnection && {
    ...gameConnection,
    state: () => director.tableState(),
  };
  const hudConnection: GameConnection | null = gameConnection && {
    ...gameConnection,
    state: () => director.hudState(),
  };

  const page = container.querySelector<HTMLElement>(".visualizer-page");
  if (gameConnection && page) {
    // Bidding waits until every card has been dealt.
    // Prompts open once your turn has been announced.
    predictionPrompt = createPredictionPrompt(page, hudConnection!, {
      blocked: () => !cardTable || cardTable.dealing || !director.turnShown(),
    });
    // A Wizard or Jester turned up for trump: the round's first player picks the suit.
    trumpPrompt = createTrumpPrompt(page, hudConnection!, {
      blocked: () => !cardTable || cardTable.dealing || !director.turnShown(),
    });
    // The banner's gameplay lines wait until every card, trump included, has landed.
    gameHud = createGameHud(page, hudConnection!, {
      blocked: () => !cardTable || cardTable.dealing,
      statusBlocked: () => !director.turnShown(),
    });
  }

  const applyLatestState = () => {
    if (seatSync && latestState && localUsername) {
      seatSync.applyPlayers(latestState.players, localUsername);
    }
    updateSelfPortrait();
    // Before the table exists the newest snapshot waits; onReady applies it.
    if (cardTable && latestState) director.push(latestState);
  };

  scene = createWizardScene(canvas, {
    demo: !live,
    onLoading: (loading) => {
      loadingEl?.classList.toggle("hidden", !loading);
      diagnostics?.note(loading ? "loading the scene" : "scene loaded");
    },
    onError: (message) => {
      diagnostics?.note(`scene error: ${message}`);
      if (loadingEl) {
        loadingEl.textContent = message;
      }
      console.error(message);
    },
    onReady: (players, environment, view) => {
      diagnostics?.note(`table ready (${live ? "live game" : "demo table"})`);
      useHeadshotRenderer(view.renderer);
      // Where everything sits around the table, read from the scene's targets.
      const layout = createTableLayout(environment);
      const sync = live ? createSeatSync(players, layout.clockwiseSeats) : null;
      seatSync = sync;

      // Cards: the stack and dealing, every player's hand, the trick and the
      // trump. Plays go to the game socket.
      cardTable = createCardTable({
        environment,
        view,
        layout,
        game: tableConnection,
        seatOf: (username) => sync?.seatOf(username) ?? null,
        headOf: (seat) => players.headPosition(seat),
        onDealDone: () => director.dealt(),
      });
      if (import.meta.env.DEV) {
        (window as unknown as Record<string, unknown>).__wizardCards = cardTable.cards;
        (window as unknown as Record<string, unknown>).__wizardTable = cardTable;
      }

      // Live games: the camera turns toward players when the director says.
      if (sync && gameConnection) {
        turnCamera = createTurnCamera({
          view,
          environment,
          layout,
          localUsername: gameConnection.localUsername,
          seatOf: (username) => sync.seatOf(username),
        });
      }

      const emoteTrigger = createEmoteTrigger(players, (emote) =>
        selfPortrait?.emote(emote),
      );
      trigger = emoteTrigger;

      if (sync) {
        // Seats first, so the card table knows where each player sits.
        applyLatestState();
        aiEmotes = createAiEmotes(emoteTrigger, () =>
          sync
            .seated()
            .filter(([, username]) => isBotName(username))
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
  gameHud?.applyState();

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

      if (message.type === "player_emote" && message.username && message.emote) {
        // Another player pressed an emote. Their character sits at the table,
        // so it plays there rather than on the corner portrait, which is only
        // ever your own.
        const seat = seatSync?.seatOf(message.username) ?? null;
        if (seat !== null && EMOTE_NAMES.includes(message.emote as Emote)) {
          trigger?.request({ target: seat, emote: message.emote as Emote, source: "network" });
        }
      }

      if (message.type === "error") {
        // Most likely a refused play, e.g. not your turn or a suit you must
        // follow: the card returns to your hand.
        console.warn("[visualizer] server refused:", message.error);
        cardTable?.refused();
        predictionPrompt?.refused(message.error ?? "The server refused that.");
        trumpPrompt?.refused(message.error ?? "The server refused that.");
        gameHud?.refused(message.error ?? "");
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
    // The other players see it on this player's character at the table.
    gameConnection?.send({ type: "emote", emote });
  });
}
