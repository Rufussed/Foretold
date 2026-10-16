import { API_BASE } from "../services/api";
import { fullRoundCount } from "../../backend/src/game/wizard/models/rounds";
import { BOT_LEVELS, DEFAULT_BOT_LEVEL } from "../../backend/src/game/wizard/botLevels";
import { t } from "../i18n";
import type { AvatarId } from "../../backend/src/game/wizard/models/avatar";
import type { Room } from "../../backend/src/game/wizard/models/wizardGame";
import { renderNavbar } from "../components/Navbar";
import { describeRuleVariations } from "../utils/rule-variations";
import { DEFAULT_GAME_OPTIONS, normalizeGameOptions } from "../../backend/src/game/wizard/gameOptions";
import {
  createAvatarPicker,
  type AvatarPicker,
} from "../visualizer/avatar-picker";
import {
  getCurrentUser,
  getActiveGameToken,
  getGuestUsername,
} from "../services/auth";
import { serverError, type ServerError } from "../i18n/server-error";

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

  const token = getActiveGameToken();

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

  const guestUsername = getGuestUsername();
  const user = localStorage.getItem("wizardToken")
    ? await getCurrentUser()
    : guestUsername
      ? {
          id: 0,
          username: guestUsername,
          displayName: t("common.stranger"),
          email: "",
        }
      : await getCurrentUser();

  if (destroyed) {
    return;
  }

  container.innerHTML = `
    <main class="room-page">

      <div id="navbar-container"></div>

      <main class="room-content">

        <section class="room-title-row">
          <a href="#/lobby" class="room-back-button">${t("common.back")}</a>

          <h1 id="room-intro" class="room-intro">${t("room.welcome")}</h1>
        </section>

        <section class="room-main-panel">

          <div class="room-avatar-section">
            <div
              id="avatar-picker"
              class="room-avatar-picker"
            ></div>

          </div>
          <p
            id="room-message"
            class="room-message"
            role="status"
            hidden
          ></p>


          <div id="room-start" class="room-start" hidden>
            <p
              id="room-message"
              class="room-message"
              role="status"
              hidden
            ></p>
            <div class="room-start-controls">

              <div class="room-start-column">
                <div class="room-start-pair">
                  <label>
                    <span>${t("room.bots")}</span>
                    <select id="room-bots"></select>
                  </label>

                  <label>
                    <span>${t("room.rounds")}</span>
                    <select id="room-rounds"></select>
                  </label>
                </div>

                <label>
                  <span>${t("room.botLevel")}</span>
                  <select id="room-bot-level">
                    ${BOT_LEVELS.map(
                      ({ level }) =>
                        `<option value="${level}"${level === DEFAULT_BOT_LEVEL ? " selected" : ""}>${t(`room.botLevel.${level}`)}</option>`,
                    ).join("")}
                  </select>
                </label>
              </div>

              <div class="room-start-column">
                <label>
                  <span>${t("room.pace")}</span>
                  <select id="room-pace">
                    <option value="1">${t("room.pace.slow")}</option>
                    <option value="1.5" selected>${t("room.pace.normal")}</option>
                    <option value="2">${t("room.pace.fast")}</option>
                    <option value="3">${t("room.pace.veryFast")}</option>
                  </select>
                </label>

                <label>
                  <span>${t("room.turnTimeout")}</span>
                  <select id="room-turn-timeout">
                    <option value="15000">${t("room.seconds", { count: "15" })}</option>
                    <option value="30000" selected>${t("room.seconds", { count: "30" })}</option>
                    <option value="45000">${t("room.seconds", { count: "45" })}</option>
                    <option value="60000">${t("room.oneMinute")}</option>
                    <option value="none">${t("room.noLimit")}</option>
                  </select>
                </label>
              </div>

              <details class="room-variations">
                <summary>${t("room.variations")}</summary>
                <div class="room-variations-controls">
                  <label>
                    <span>${t("room.firstRound")}</span>
                    <select id="room-blind-first-round">
                      <option value="false">${t("room.firstRound.own")}</option>
                      <option value="true" selected>${t("room.firstRound.blind")}</option>
                    </select>
                  </label>

                  <label>
                    <span>${t("room.wizardWins")}</span>
                    <select id="room-wizard-wins">
                      <option value="first">${t("room.wizardWins.first")}</option>
                      <option value="last" selected>${t("room.wizardWins.last")}</option>
                    </select>
                  </label>

                </div>
              </details>

              <button
                type="button"
                id="room-start-button"
                class="room-start-button"
              >
                ${t("room.start")}
              </button>

            </div>
          </div>

          <p
            id="room-variations-summary"
            class="room-variations-summary"
            hidden
          ></p>

          <p
            id="room-waiting"
            class="room-waiting"
            hidden
          >
            ${t("room.waiting")}
          </p>

        </section>

      </main>

    </main>
  `;

  const navbarContainer =
    container.querySelector<HTMLDivElement>("#navbar-container");

  if (navbarContainer) {
    renderNavbar(navbarContainer, user);
  }

  const element = <T extends HTMLElement>(selector: string): T => {
    const found = container.querySelector<T>(selector);
    if (!found) throw new Error(`Room page element ${selector} missing`);
    return found;
  };

  // One line: the room, who's here, and an invitation to pick a portrait.
  const introEl = element<HTMLHeadingElement>("#room-intro");
  const messageEl = element<HTMLParagraphElement>("#room-message");
  // A guest's username is a generated id, so they are greeted as a stranger.
  const greeting = guestUsername !== null ? t("common.stranger") : user.username;
  const startEl = element<HTMLDivElement>("#room-start");
  const botsEl = element<HTMLSelectElement>("#room-bots");
  const roundsEl = element<HTMLSelectElement>("#room-rounds");
  // How well the NPCs play. See botLevels.ts.
  const botLevelEl = element<HTMLSelectElement>("#room-bot-level");
  // How fast the game plays out, for everyone in it: the server's pauses and
  // the table's animations both scale by it. See gameplayPace.ts.
  const paceEl = element<HTMLSelectElement>("#room-pace");
  // The rule variations, for everyone in the game. See gameOptions.ts.
  const wizardWinsEl = element<HTMLSelectElement>("#room-wizard-wins");
  const blindFirstRoundEl = element<HTMLSelectElement>("#room-blind-first-round");
  // How long a human player has for each move before the game makes it for
  // them; "none" for no limit. See turnTimeout.ts.
  const turnTimeoutEl = element<HTMLSelectElement>("#room-turn-timeout");
  // What the host has chosen, for everyone else waiting.
  const variationsSummaryEl = element<HTMLParagraphElement>("#room-variations-summary");
  const chosenOptions = () => ({
    wizardWins: wizardWinsEl.value,
    blindFirstRound: blindFirstRoundEl.value === "true",
    turnTimeoutMs: turnTimeoutEl.value === "none" ? null : Number(turnTimeoutEl.value),
  });
  let humanCount = 0;
  let maxPlayers = 0;

  // Rounds to choose from: a full game for this many players down to 1. A
  // longer choice than the new player count allows falls back to a full game.
  const updateRoundOptions = () => {
    // The all-NPC option replaces the host, so the table is never over full.
    const full = fullRoundCount(Math.min(humanCount + Number(botsEl.value || 0), maxPlayers));
    const values = full ? Array.from({ length: full }, (_, index) => String(full - index)) : [];
    const current = [...roundsEl.options].map((option) => option.value);
    if (current.join() === values.join()) return;
    const selected = roundsEl.value;
    roundsEl.replaceChildren(
      ...values.map((value, index) => new Option(index === 0 ? t("room.fullGame", { count: value }) : value, value)),
    );
    // A guest's game starts at 8 rounds; a longer or shorter choice stands.
    const preferred = selected || (guestUsername !== null ? "8" : "");
    roundsEl.value = values.includes(preferred) ? preferred : values[0] ?? "";
  };
  botsEl.addEventListener("change", updateRoundOptions);
  const startButton = element<HTMLButtonElement>("#room-start-button");

  const waitingEl = element<HTMLParagraphElement>("#room-waiting");

  let room: Room | null = null;
  // Whether the host's selects have been set from what the room saved, so a
  // reload keeps their choices.
  let optionsLoaded = false;
  // The avatar just clicked, shown before the server confirms it.
  let pendingAvatar: AvatarId | null = null;

  const showMessage = (text: string) => {
    messageEl.textContent = text;
    messageEl.hidden = !text;
  };

  const render = () => {
    if (!room || !picker) {
      return;
    }

    // The server names a guest's room after their generated username.
    const roomName =
      guestUsername !== null ? room.name.replace(guestUsername, t("common.stranger")) : room.name;
    // A guest plays against NPCs alone, so the head count means nothing to them.
    const present =
      guestUsername !== null
        ? ""
        : t("room.present", {
            count: String(room.players.length),
            max: String(room.maxPlayers),
          });
    introEl.textContent = `${t("room.intro", { room: roomName })}${present} ${t("room.chooseAvatar", { name: greeting })}`;

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

    const isGuest = guestUsername !== null;

    const isHost = isGuest || room.createdBy === user.id;

    startEl.hidden = !isHost;
    waitingEl.hidden = isHost;

    const options = normalizeGameOptions(room.options, DEFAULT_GAME_OPTIONS);
    variationsSummaryEl.hidden = isHost;
    variationsSummaryEl.textContent = describeRuleVariations(options, room.turnTimeoutMs);
    if (isHost && !optionsLoaded) {
      optionsLoaded = true;
      wizardWinsEl.value = options.wizardWins;
      blindFirstRoundEl.value = String(options.blindFirstRound);
      turnTimeoutEl.value = room.turnTimeoutMs === null ? "none" : String(room.turnTimeoutMs);
    }

    if (!isHost) {
      waitingEl.textContent = t("room.waiting");
    }

    if (isHost) {
      // A game needs 3 to 6 players; bots make up the difference. Alone, the
      // host can also pick one NPC per seat: an all-NPC game, played by
      // "<host> NPC" while they watch.
      const freeSeats = room.maxPlayers - room.players.length;
      const minimumBots = Math.max(0, 3 - room.players.length);
      const maximumBots = room.players.length === 1 ? room.maxPlayers : freeSeats;
      const options = Array.from(
        { length: Math.max(0, maximumBots - minimumBots + 1) },
        (_, index) => String(minimumBots + index),
      );
      const current = [...botsEl.options].map((option) => option.value);

      if (current.join() !== options.join()) {
        const selected = botsEl.value;
        botsEl.replaceChildren(
          ...options.map((value) =>
            new Option(Number(value) > freeSeats ? t("room.botsWatch", { count: value }) : value, value),
          ),
        );
        // Every free seat filled, unless the host already chose.
        // A guest starts with 4 NPCs besides themselves.
        const wanted = guestUsername !== null ? "4" : String(freeSeats);
        const fallback = options.includes(wanted) ? wanted : options[0] ?? "";
        botsEl.value = current.length && options.includes(selected) ? selected : fallback;
      }

      humanCount = room.players.length;
      maxPlayers = room.maxPlayers;
      updateRoundOptions();
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

        const data = (await response.json()) as Room & ServerError;

        if (destroyed) {
          return;
        }

        if (response.ok) {
          room = data;
        } else if (claim === latestClaim) {
          showMessage(serverError(data, "room.avatarFailed"));
        }
      } catch (error) {
        console.warn("[room] avatar claim failed:", error);

        if (claim === latestClaim) {
          showMessage(t("common.noServer"));
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
      const response = await fetch(`${API_BASE}/wizard/lobby/${roomId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (destroyed) {
        return;
      }

      if (response.status === 404) {
        showMessage(t("room.gone"));
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
            window.location.hash = `#/game/${roomId}/visualizer`;
          } else {
            showMessage(t("room.alreadyStarted"));
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

  // The host's rule variations are saved to the room as they change, so
  // everyone waiting sees them. One save at a time, so they land in order.
  let optionsSave = Promise.resolve();
  const saveOptions = () => {
    const options = chosenOptions();
    optionsSave = optionsSave.then(async () => {
      if (destroyed) return;
      try {
        const response = await fetch(`${API_BASE}/wizard/lobby/${roomId}/options`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(options),
        });
        if (!response.ok) {
          const data = (await response.json()) as ServerError;
          showMessage(serverError(data, "room.saveFailed"));
        }
      } catch (error) {
        console.warn("[room] saving rule variations failed:", error);
      }
    });
  };
  wizardWinsEl.addEventListener("change", saveOptions);
  blindFirstRoundEl.addEventListener("change", saveOptions);
  turnTimeoutEl.addEventListener("change", saveOptions);

  startButton.addEventListener("click", async () => {
    startButton.disabled = true;
    showMessage("");

    try {
      // The time per move goes with the room, not the start: the game takes
      // the room's saved one, so a save still on its way lands first.
      const { turnTimeoutMs: _saved, ...rules } = chosenOptions();
      await optionsSave;
      const response = await fetch(`${API_BASE}/wizard/games`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          roomId,
          botCount: Number(botsEl.value),
          maxRounds: Number(roundsEl.value),
          pace: Number(paceEl.value),
          botLevel: botLevelEl.value,
          ...rules,
        }),
      });

      const data = (await response.json()) as ServerError;

      // 409 means the game already exists, which is where we're headed anyway.
      if (!response.ok && response.status !== 409) {
        throw new Error(serverError(data, "room.startFailed"));
      }

      window.location.hash = `#/game/${roomId}/visualizer`;
    } catch (error) {
      showMessage(
        error instanceof Error ? error.message : t("room.startFailed"),
      );
      startButton.disabled = false;
    }
  });

  // Joining is idempotent, so opening the room is enough to take a seat: the
  // lobby's Join button and a shared room link both land here.
  try {
    const response = await fetch(`${API_BASE}/wizard/lobby/${roomId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
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
        const data = (await joined.json()) as ServerError;
        showMessage(serverError(data, "room.joinFailed"));
        return;
      }
    }
  } catch (error) {
    console.warn("[room] join failed:", error);
  }

  if (destroyed) {
    return;
  }

  // The portraits are 3D, and a browser can refuse WebGL: hardware
  // acceleration turned off, or a privacy setting that blocks it. That must
  // not take the rest of the room with it, so the picker's buttons keep
  // working with their names alone and the players list still loads.
  try {
    picker = createAvatarPicker(element<HTMLDivElement>("#avatar-picker"), {
      onSelect: claimAvatar,
    });
  } catch (error) {
    console.warn("[room] no 3D avatar portraits in this browser:", error);
  }

  await poll();
}
