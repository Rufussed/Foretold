import { API_BASE } from "../services/api";
import { getCurrentUser, getToken } from "../services/auth";
import type { AvatarId } from "../../backend/src/game/wizard/models/avatar";
import type { Room } from "../../backend/src/game/wizard/models/wizardGame";
import {
  CHARACTER_LABELS,
  createAvatarPicker,
  type AvatarPicker,
} from "../visualizer/avatar-picker";

// The lobby socket only exists once a game starts, so the waiting room polls.
const POLL_MS = 2000;

let activeRoom: { destroy(): void } | null = null;

// The router replaces container.innerHTML on navigation, which would leave the
// picker's render loop, WebGL context and poll timer running. Tear down first.
export function destroyRoomPage(): void {
  activeRoom?.destroy();
  activeRoom = null;
}

export async function renderRoomPage(
  container: HTMLElement,
  roomId: number,
): Promise<void> {
  destroyRoomPage();

  const token = getToken();

  if (!token) {
    window.location.hash = "#/home";
    return;
  }

  let destroyed = false;
  let pollTimer = 0;
  let picker: AvatarPicker | null = null;

  const handle = {
    destroy() {
      destroyed = true;
      window.clearTimeout(pollTimer);
      picker?.destroy();
      picker = null;
    },
  };
  activeRoom = handle;

  const user = await getCurrentUser();

  if (destroyed) {
    return;
  }

  container.innerHTML = `
    <div class="page room-page">
      <nav class="navbar">
        <a href="#/lobby">Back to Lobby</a>
      </nav>

      <main class="panel">
        <h1 id="room-name">Waiting room</h1>
        <p id="room-count" class="room-count"></p>

        <h2>Choose your avatar</h2>
        <div id="avatar-picker"></div>
        <p id="room-message" class="room-message" role="status"></p>

        <h2>Players</h2>
        <ul id="room-players" class="room-players"></ul>

        <div id="room-start" class="room-start" hidden>
          <label>
            NPCs
            <select id="room-bots"></select>
          </label>
          <button type="button" id="room-start-button">Start game</button>
        </div>

        <p id="room-waiting" hidden>Waiting for the host to start the game…</p>
      </main>
    </div>
  `;

  const element = <T extends HTMLElement>(selector: string): T => {
    const found = container.querySelector<T>(selector);
    if (!found) throw new Error(`Room page element ${selector} missing`);
    return found;
  };

  const nameEl = element<HTMLHeadingElement>("#room-name");
  const countEl = element<HTMLParagraphElement>("#room-count");
  const messageEl = element<HTMLParagraphElement>("#room-message");
  const playersEl = element<HTMLUListElement>("#room-players");
  const startEl = element<HTMLDivElement>("#room-start");
  const botsEl = element<HTMLSelectElement>("#room-bots");
  const startButton = element<HTMLButtonElement>("#room-start-button");
  const waitingEl = element<HTMLParagraphElement>("#room-waiting");

  let room: Room | null = null;
  // The avatar just clicked, shown before the server confirms it.
  let pendingAvatar: AvatarId | null = null;

  const showMessage = (text: string) => {
    messageEl.textContent = text;
  };

  const render = () => {
    if (!room || !picker) {
      return;
    }

    nameEl.textContent = room.name;
    countEl.textContent = `${room.players.length}/${room.maxPlayers} players`;

    const claims = new Map<AvatarId, string>();

    for (const player of room.players) {
      if (player.avatar && player.username !== user.username) {
        claims.set(player.avatar, player.username);
      }
    }

    const mine =
      pendingAvatar ??
      room.players.find((player) => player.username === user.username)?.avatar;

    if (mine && !claims.has(mine)) {
      claims.set(mine, user.username);
    }

    picker.setClaims(claims, user.username);

    playersEl.replaceChildren(
      ...room.players.map((player) => {
        const item = document.createElement("li");
        item.className = "room-player";
        item.textContent =
          player.username === user.username
            ? `${player.username} (you)`
            : player.username;

        const avatar = document.createElement("span");
        avatar.className = "room-player-avatar";
        avatar.textContent = player.avatar
          ? CHARACTER_LABELS[player.avatar]
          : "choosing…";
        item.append(avatar);

        return item;
      }),
    );

    const isHost = room.createdBy === user.id;
    startEl.hidden = !isHost;
    waitingEl.hidden = isHost;

    if (isHost) {
      // A game needs 3 to 6 players; bots make up the difference.
      const minimumBots = Math.max(0, 3 - room.players.length);
      const maximumBots = room.maxPlayers - room.players.length;
      const options = Array.from(
        { length: Math.max(0, maximumBots - minimumBots + 1) },
        (_, index) => String(minimumBots + index),
      );
      const current = [...botsEl.options].map((option) => option.value);

      if (current.join() !== options.join()) {
        const selected = botsEl.value;
        botsEl.replaceChildren(
          ...options.map((value) => new Option(value, value)),
        );
        botsEl.value = options.includes(selected) ? selected : options[0] ?? "";
      }

      startButton.disabled = options.length === 0;
    }
  };

  // Claims go out one at a time, so a quick second click can't land on the
  // server before the first and leave the room showing the wrong avatar.
  let claimQueue = Promise.resolve();
  let latestClaim = 0;

  const claimAvatar = (avatar: AvatarId) => {
    const claim = ++latestClaim;
    pendingAvatar = avatar;
    showMessage("");
    render();

    claimQueue = claimQueue.then(async () => {
      // A newer click supersedes this one before it was even sent.
      if (destroyed || claim !== latestClaim) {
        return;
      }

      try {
        const response = await fetch(
          `${API_BASE}/wizard/lobby/${roomId}/avatar`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ avatar }),
          },
        );

        const data = (await response.json()) as Room & { error?: string };

        if (destroyed) {
          return;
        }

        if (response.ok) {
          room = data;
        } else if (claim === latestClaim) {
          showMessage(data.error ?? "Could not choose that avatar");
        }
      } catch (error) {
        console.warn("[room] avatar claim failed:", error);

        if (claim === latestClaim) {
          showMessage("Could not reach the server");
        }
      }

      if (claim === latestClaim) {
        pendingAvatar = null;
        render();
      }
    });
  };

  const poll = async () => {
    try {
      const response = await fetch(`${API_BASE}/wizard/lobby/${roomId}`);

      if (destroyed) {
        return;
      }

      if (response.status === 404) {
        showMessage("This room no longer exists.");
        return;
      }

      if (response.ok) {
        const latest = (await response.json()) as Room;

        if (destroyed) {
          return;
        }

        const isMember = latest.players.some(
          (player) => player.username === user.username,
        );

        if (latest.status === "playing") {
          if (isMember) {
            window.location.hash = `#/game/${roomId}`;
          } else {
            showMessage("This game has already started.");
          }
          return;
        }

        room = latest;
        render();
      }
    } catch (error) {
      console.warn("[room] poll failed:", error);
    }

    if (!destroyed) {
      pollTimer = window.setTimeout(poll, POLL_MS);
    }
  };

  startButton.addEventListener("click", async () => {
    startButton.disabled = true;
    showMessage("");

    try {
      const response = await fetch(`${API_BASE}/wizard/games`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ roomId, botCount: Number(botsEl.value) }),
      });

      const data = (await response.json()) as { error?: string };

      // 409 means the game already exists, which is where we're headed anyway.
      if (!response.ok && response.status !== 409) {
        throw new Error(data.error ?? "Could not start game");
      }

      window.location.hash = `#/game/${roomId}`;
    } catch (error) {
      showMessage(
        error instanceof Error ? error.message : "Could not start game",
      );
      startButton.disabled = false;
    }
  });

  // Joining is idempotent, so opening the room is enough to take a seat: the
  // lobby's Join button and a shared room link both land here.
  try {
    const response = await fetch(`${API_BASE}/wizard/lobby/${roomId}`);
    const current = response.ok ? ((await response.json()) as Room) : null;

    if (destroyed) {
      return;
    }

    const isMember = current?.players.some(
      (player) => player.username === user.username,
    );

    if (current && current.status === "waiting" && !isMember) {
      const joined = await fetch(`${API_BASE}/wizard/lobby/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ roomId }),
      });

      if (destroyed) {
        return;
      }

      if (!joined.ok) {
        const data = (await joined.json()) as { error?: string };
        showMessage(data.error ?? "Could not join this room");
        return;
      }
    }
  } catch (error) {
    console.warn("[room] join failed:", error);
  }

  if (destroyed) {
    return;
  }

  picker = createAvatarPicker(element<HTMLDivElement>("#avatar-picker"), {
    onSelect: claimAvatar,
  });

  await poll();
}
