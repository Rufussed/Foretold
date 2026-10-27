import { API_BASE } from "../services/api";
import { fullRoundCount } from "../../backend/src/game/wizard/models/rounds";
import { BOT_LEVELS, DEFAULT_BOT_LEVEL } from "../../backend/src/game/wizard/botLevels";
import { t } from "../i18n";
import type { AvatarId } from "../../backend/src/game/wizard/models/avatar";
import type { Room } from "../../backend/src/game/wizard/models/wizardGame";
import { renderNavbar } from "../components/Navbar";
import { openStartSummary, type StartSummaryRow } from "../components/start-summary";
import { describeRuleVariations } from "../utils/rule-variations";
import { escapeHtml } from "../utils/escape-html";
import { displayName } from "../utils/display-name";
import {
  DEFAULT_GAME_OPTIONS,
  MISSED_TURNS_OPTIONS,
  normalizeGameOptions,
} from "../../backend/src/game/wizard/gameOptions";
import {
  createAvatarPicker,
  type AvatarPicker,
} from "../visualizer/avatar-picker";
import {
  getCurrentUser,
  getActiveGameToken,
  getGuestUsername,
  getInvitedGuestRoomId,
  endGuestSession,
} from "../services/auth";
import { serverError, type ServerError } from "../i18n/server-error";
import { GAME_MODES } from "../../backend/src/game/wizard/modes/modes";
import { gameModeBadge, gameModeName } from "../utils/game-mode";
import { ROLES, isRoleId, type RoleId } from "../../backend/src/game/wizard/modes/roles/roles";
import { openRolesHelp, rolesHelpButton } from "../modes/roles/roles-help";

// The lobby socket only exists once a game starts, so the waiting room polls.
const POLL_MS = 2000;

let activeRoom: { destroy(): void } | null = null;

// The router replaces container.innerHTML on navigation, which would leave the
// picker's render loop, WebGL context and poll timer running. Tear down first.
export function destroyRoomPage(): void {
  activeRoom?.destroy();
  activeRoom = null;
}

// The role list's options: a prompt, then each role with its card's number.
function roleOptions(): string {
  return [
    `<option value="" selected disabled>${t("room.role.choose")}</option>`,
    ...ROLES.map(({ id, card }) => `<option value="${id}">${card} · ${t(`role.${id}`)}</option>`),
  ].join("");
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
  // Two kinds of guest: one playing alone from Home, who hosts their own
  // table, and one invited to a guest room, who sits at someone else's.
  const isInvitedGuest = getInvitedGuestRoomId() !== null;
  const isSoloGuest = guestUsername !== null && !isInvitedGuest;
  const user = localStorage.getItem("wizardToken")
    ? await getCurrentUser()
    : guestUsername
      ? {
          id: 0,
          username: guestUsername,
          displayName: displayName(guestUsername),
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
          <h1 id="room-intro" class="room-intro">${t("room.welcome")}</h1>
        </section>

        <section id="room-invite" class="room-invite" hidden>
          <p class="room-invite-title">${t("room.invite.title")}</p>
          <div class="room-invite-row">
            <input
              id="room-invite-link"
              class="room-invite-link"
              type="text"
              readonly
              aria-label="${t("room.invite.title")}"
            />
            <button type="button" id="room-invite-copy" class="room-invite-button">
              ${t("room.invite.copy")}
            </button>
            <button type="button" id="room-invite-renew" class="room-invite-button is-quiet">
              ${t("room.invite.renew")}
            </button>
          </div>
          <p class="room-invite-note">${t("room.invite.note")}</p>
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

              <label class="room-mode-field">
                <span>${t("lobby.mode")}</span>
                <select id="room-mode">
                  ${GAME_MODES.map(
                    (mode) =>
                      `<option value="${mode}"${mode === "classic" ? " selected" : ""}>${gameModeName(mode)}</option>`,
                  ).join("")}
                </select>
              </label>

              <label class="room-role-field mode-roles" hidden>
                <span>${t("room.role")}</span>
                <span class="room-role-row">
                  <select class="room-role-select">${roleOptions()}</select>
                  ${rolesHelpButton()}
                </span>
              </label>

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
                      <option value="false" selected>${t("room.firstRound.own")}</option>
                      <option value="true">${t("room.firstRound.blind")}</option>
                    </select>
                  </label>

                  <label>
                    <span>${t("room.wizardWins")}</span>
                    <select id="room-wizard-wins">
                      <option value="first" selected>${t("room.wizardWins.first")}</option>
                      <option value="last">${t("room.wizardWins.last")}</option>
                    </select>
                  </label>

                  <label>
                    <span>${t("room.missedTurns")}</span>
                    <select id="room-missed-turns">
                      ${MISSED_TURNS_OPTIONS.map(
                        (count) =>
                          `<option value="${count ?? "off"}"${count === DEFAULT_GAME_OPTIONS.missedTurnsToQuit ? " selected" : ""}>${
                            count === null
                              ? t("room.missedTurns.off")
                              : t(
                                  count === DEFAULT_GAME_OPTIONS.missedTurnsToQuit
                                    ? "room.missedTurns.default"
                                    : "room.missedTurns.count",
                                  { count: String(count) },
                                )
                          }</option>`,
                      ).join("")}
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

          <label id="room-role-own" class="room-role-own mode-roles" hidden>
            <span>${t("room.role")}</span>
            <span class="room-role-row">
              <select class="room-role-select">${roleOptions()}</select>
              ${rolesHelpButton()}
            </span>
          </label>

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
  // A guest's username is a generated id: they are greeted by the name they
  // chose, or as a stranger when playing alone.
  const greeting = guestUsername !== null ? displayName(guestUsername) : user.username;
  const startEl = element<HTMLDivElement>("#room-start");
  // A Roles room's role, chosen from a list: in the host's settings, or on
  // its own for everyone else (modes/roles/roles.ts). For now the choice is
  // only shown on this page; it is not sent to the server yet.
  const hostRoleEl = element<HTMLLabelElement>(".room-role-field");
  const ownRoleEl = element<HTMLLabelElement>("#room-role-own");
  const roleSelects = [...container.querySelectorAll<HTMLSelectElement>(".room-role-select")];
  let chosenRole: RoleId | null = null;
  for (const button of container.querySelectorAll<HTMLButtonElement>(".roles-help-button")) {
    button.addEventListener("click", (event) => {
      // Inside the role's label, which would otherwise open the list.
      event.preventDefault();
      openRolesHelp();
    });
  }
  for (const select of roleSelects) {
    select.addEventListener("change", () => {
      chosenRole = isRoleId(select.value) ? select.value : null;
      // Both lists show the same choice, with its power as the hint.
      for (const other of roleSelects) {
        other.value = chosenRole ?? "";
        other.title = chosenRole ? t(`role.${chosenRole}.power`) : "";
      }
    });
  }
  const botsEl = element<HTMLSelectElement>("#room-bots");
  const roundsEl = element<HTMLSelectElement>("#room-rounds");
  // How well the NPCs play. See botLevels.ts.
  const botLevelEl = element<HTMLSelectElement>("#room-bot-level");
  // How fast the game plays out, for everyone in it: the server's pauses and
  // the table's animations both scale by it. See gameplayPace.ts.
  const paceEl = element<HTMLSelectElement>("#room-pace");
  // Which game is played, for everyone in it. See modes/modes.ts.
  const modeEl = element<HTMLSelectElement>("#room-mode");
  // The rule variations, for everyone in the game. See gameOptions.ts.
  const wizardWinsEl = element<HTMLSelectElement>("#room-wizard-wins");
  const blindFirstRoundEl = element<HTMLSelectElement>("#room-blind-first-round");
  // Missed turns in a row before a player counts as gone and a bot takes the
  // seat; "off" for never. See gameOptions.ts and the backend's playerQuit.ts.
  const missedTurnsEl = element<HTMLSelectElement>("#room-missed-turns");
  // How long a human player has for each move before the game makes it for
  // them; "none" for no limit. See turnTimeout.ts.
  const turnTimeoutEl = element<HTMLSelectElement>("#room-turn-timeout");
  // What the host has chosen, for everyone else waiting.
  const variationsSummaryEl = element<HTMLParagraphElement>("#room-variations-summary");
  const chosenOptions = () => ({
    mode: modeEl.value,
    wizardWins: wizardWinsEl.value,
    blindFirstRound: blindFirstRoundEl.value === "true",
    missedTurnsToQuit: missedTurnsEl.value === "off" ? null : Number(missedTurnsEl.value),
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
    const preferred = selected || (isSoloGuest ? "8" : "");
    roundsEl.value = values.includes(preferred) ? preferred : values[0] ?? "";
  };
  botsEl.addEventListener("change", updateRoundOptions);
  const startButton = element<HTMLButtonElement>("#room-start-button");

  const waitingEl = element<HTMLParagraphElement>("#room-waiting");

  const inviteEl = element<HTMLElement>("#room-invite");
  const inviteLinkEl = element<HTMLInputElement>("#room-invite-link");
  const inviteCopyEl = element<HTMLButtonElement>("#room-invite-copy");
  const inviteRenewEl = element<HTMLButtonElement>("#room-invite-renew");
  // The address the guests open: this site, at the join page for the code.
  const inviteLink = (code: string) =>
    `${window.location.origin}${window.location.pathname}#/join/${code}`;

  inviteLinkEl.addEventListener("focus", () => inviteLinkEl.select());

  inviteCopyEl.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(inviteLinkEl.value);
    } catch {
      // No clipboard (an insecure page, an old browser): selected to copy by hand.
      inviteLinkEl.select();
      return;
    }
    inviteCopyEl.textContent = t("room.invite.copied");
    window.setTimeout(() => {
      inviteCopyEl.textContent = t("room.invite.copy");
    }, 2000);
  });

  // A new link for when the old one reached the wrong people.
  inviteRenewEl.addEventListener("click", async () => {
    inviteRenewEl.disabled = true;
    try {
      const response = await fetch(`${API_BASE}/wizard/lobby/${roomId}/invite`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await response.json()) as { inviteCode?: string } & ServerError;
      if (!response.ok || !data.inviteCode) {
        showMessage(serverError(data, "room.invite.renewFailed"));
      } else if (room) {
        room = { ...room, inviteCode: data.inviteCode };
        render();
      }
    } catch {
      showMessage(t("common.noServer"));
    } finally {
      inviteRenewEl.disabled = false;
    }
  });

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
      isSoloGuest && guestUsername !== null
        ? room.name.replace(guestUsername, t("common.stranger"))
        : room.name;
    // A guest plays against NPCs alone, so the head count means nothing to them.
    const isFull = room.players.length >= room.maxPlayers;
    const present =
      isSoloGuest
        ? ""
        : t(isFull ? "room.presentFull" : "room.present", {
            count: String(room.players.length),
            max: String(room.maxPlayers),
          });
    // Three lines, easier to take in on a small screen: the room's name in
    // gold, who's here, and the invitation to pick a portrait.
    introEl.innerHTML = [
      t("room.intro", {
        room: `<span class="room-intro-name">${escapeHtml(roomName)}</span>${gameModeBadge(
          normalizeGameOptions(room.options, DEFAULT_GAME_OPTIONS).mode,
        )}`,
      }),
      present,
      t("room.chooseAvatar", { name: escapeHtml(greeting) }),
    ]
      .filter(Boolean)
      .map((line) => `<span class="room-intro-line">${line}</span>`)
      .join("");

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

    const isHost = isSoloGuest || room.createdBy === user.id;

    // A guest room's host hands out its invite link from here.
    inviteEl.hidden = !(isHost && room.inviteCode);
    if (isHost && room.inviteCode) {
      const link = inviteLink(room.inviteCode);
      if (inviteLinkEl.value !== link) inviteLinkEl.value = link;
    }

    startEl.hidden = !isHost;
    waitingEl.hidden = isHost;

    const options = normalizeGameOptions(room.options, DEFAULT_GAME_OPTIONS);
    const isRoles = options.mode === "roles";
    hostRoleEl.hidden = !isRoles;
    ownRoleEl.hidden = !isRoles || isHost;
    variationsSummaryEl.hidden = isHost;
    variationsSummaryEl.textContent = describeRuleVariations(options, room.turnTimeoutMs);
    if (isHost && !optionsLoaded) {
      optionsLoaded = true;
      modeEl.value = options.mode;
      wizardWinsEl.value = options.wizardWins;
      blindFirstRoundEl.value = String(options.blindFirstRound);
      missedTurnsEl.value = String(options.missedTurnsToQuit ?? "off");
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
        const wanted = isSoloGuest ? "4" : String(freeSeats);
        const fallback = options.includes(wanted) ? wanted : options[0] ?? "";
        botsEl.value = current.length && options.includes(selected) ? selected : fallback;
      }

      humanCount = room.players.length;
      maxPlayers = room.maxPlayers;
      updateRoundOptions();
      startButton.disabled = options.length === 0;
      // Every seat taken: Start game glows gold until someone leaves.
      startButton.classList.toggle("is-ready", isFull);
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
        // An invited guest's seat went with the room: the visit is over.
        if (isInvitedGuest) {
          endGuestSession();
          showMessage(t("room.closedByHost"));
        } else {
          showMessage(t("room.gone"));
        }
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

        const hasLeft = latest.players.some(
          (player) => player.username === user.username && player.quit === true,
        );

        if (latest.status === "playing") {
          if (hasLeft) {
            showMessage(t("room.youLeft"));
          } else if (isMember) {
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
  modeEl.addEventListener("change", saveOptions);
  wizardWinsEl.addEventListener("change", saveOptions);
  blindFirstRoundEl.addEventListener("change", saveOptions);
  missedTurnsEl.addEventListener("change", saveOptions);
  turnTimeoutEl.addEventListener("change", saveOptions);

  // What a select shows, and whether it differs from the page's default.
  const chosen = (select: HTMLSelectElement): { value: string; changed: boolean } => {
    const option = select.selectedOptions[0];
    return { value: option?.text ?? "", changed: option ? !option.defaultSelected : false };
  };

  // Start game first shows everything chosen, as nothing can change once the
  // game runs; the game itself starts from there (startGame).
  const summaryRows = (): StartSummaryRow[] => {
    const wizards = (room?.players ?? []).map((player) =>
      player.username === user.username ? greeting : displayName(player.username),
    );
    const rows: StartSummaryRow[] = [
      { label: t("lobby.mode"), ...chosen(modeEl) },
      { label: t("start.wizards"), value: wizards.join(", ") },
      { label: t("room.bots"), value: chosen(botsEl).value },
    ];
    if (Number(botsEl.value) > 0) {
      rows.push({ label: t("room.botLevel"), ...chosen(botLevelEl) });
    }
    rows.push(
      // A full game is the first choice; fewer rounds is the host's own.
      { label: t("room.rounds"), value: chosen(roundsEl).value, changed: roundsEl.selectedIndex > 0 },
      { label: t("room.pace"), ...chosen(paceEl) },
      { label: t("room.turnTimeout"), ...chosen(turnTimeoutEl) },
      { label: t("room.missedTurns"), ...chosen(missedTurnsEl) },
      { label: t("room.firstRound"), ...chosen(blindFirstRoundEl) },
      { label: t("room.wizardWins"), ...chosen(wizardWinsEl) },
    );
    return rows;
  };

  const startGame = async () => {
    startButton.disabled = true;
    showMessage("");

    try {
      // The time per move goes with the room, not the start: the game takes
      // the room's saved one, so a save still on its way lands first.
      // The mode too: the game takes the room's saved one.
      const { turnTimeoutMs: _saved, mode: _mode, ...rules } = chosenOptions();
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
  };

  startButton.addEventListener("click", () => {
    showMessage("");
    openStartSummary(summaryRows(), () => void startGame());
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
