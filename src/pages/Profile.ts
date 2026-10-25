import { startedGameHash, watchStartedGame } from "../services/started-game";
import {
  getCurrentUser,
  getCurrentUserOpponents,
  getCurrentUserStats,
  getPlayerProfile,
} from "../services/auth";
import {
  acceptFriendRequest,
  getFriendRequests,
  getFriendStatus,
  getFriends,
  rejectFriendRequest,
  removeFriend,
  searchPlayers,
  sendFriendRequest,
} from "../services/friends";
import type { PlayerOpponent } from "../types/auth";
import type {
  Friend,
  FriendRelationshipStatus,
  FriendRequest,
  PlayerSearchResult,
} from "../services/friends";
import { renderNavbar } from "../components/Navbar";
import { escapeHtml } from "../utils/escape-html";
import { t, type MessageKey } from "../i18n";

// About half the 400 points of a perfect three-player game, so short games
// can earn a level too: 200 points stand in for one full game.
const POINTS_PER_FULL_GAME = 200;

const PLAYER_LEVELS: { name: MessageKey; fullGames: number }[] = [
  { name: "profile.level.expert", fullGames: 75 },
  { name: "profile.level.advanced", fullGames: 30 },
  { name: "profile.level.intermediate", fullGames: 10 },
];

// Reached by full games or by the highest total points ever held, whichever
// gets there first. Neither goes down, so neither does the level.
function getPlayerLevel(
  fullGamesFinished: number,
  peakTotalPoints: number,
): string {
  const level = PLAYER_LEVELS.find(
    ({ fullGames }) =>
      fullGamesFinished >= fullGames ||
      peakTotalPoints >= fullGames * POINTS_PER_FULL_GAME,
  );

  return t(level?.name ?? "profile.level.novice");
}

// How often the profile asks again for friends and friend requests.
const SOCIAL_REFRESH_MS = 15000;

const HISTORY_LIMITS = [20, 50, 100];
const HISTORY_PREFS_KEY = "wizardProfileHistory";

// From this many friends on, a filter box sits above the list.
const FRIEND_FILTER_FROM = 8;

type HistorySort = "recent" | "games";

interface HistoryPrefs {
  open: boolean;
  limit: number;
  sort: HistorySort;
}

// How the player left the history: open or closed, how many rows, which order.
// Only a convenience, so a browser that keeps nothing gets the defaults.
function loadHistoryPrefs(): HistoryPrefs {
  try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_PREFS_KEY) ?? "{}");
    return {
      open: saved.open === true,
      limit: HISTORY_LIMITS.includes(saved.limit) ? saved.limit : HISTORY_LIMITS[0],
      sort: saved.sort === "games" ? "games" : "recent",
    };
  } catch {
    return { open: false, limit: HISTORY_LIMITS[0], sort: "recent" };
  }
}

function saveHistoryPrefs(prefs: HistoryPrefs): void {
  try {
    localStorage.setItem(HISTORY_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Not kept; the page works the same.
  }
}

const PANELS_KEY = "wizardProfilePanels";

type SocialPanel = "social" | "friends" | "requests";

// Which social panels the player left open; all open the first time.
function loadSocialPanels(): Record<SocialPanel, boolean> {
  try {
    const saved = JSON.parse(localStorage.getItem(PANELS_KEY) ?? "{}");
    return {
      social: saved.social !== false,
      friends: saved.friends !== false,
      requests: saved.requests !== false,
    };
  } catch {
    return { social: true, friends: true, requests: true };
  }
}

function saveSocialPanels(panels: Record<SocialPanel, boolean>): void {
  try {
    localStorage.setItem(PANELS_KEY, JSON.stringify(panels));
  } catch {
    // Not kept; the page works the same.
  }
}

// The attributes that make a header open and close the body below it; the
// body carries data-collapse-body with the same name.
const collapseToggle = (name: string, open: boolean): string =>
  `role="button" tabindex="0" aria-expanded="${open}" data-collapse="${name}"`;

const collapseBody = (name: string, open: boolean): string =>
  `data-collapse-body="${name}" ${open ? "" : "hidden"}`;

// Wires a header made with collapseToggle to its body. Returns a function that
// opens or closes it from code.
function setupCollapsible(
  container: HTMLElement,
  name: string,
  onChange: (open: boolean) => void,
): (open: boolean) => void {
  const toggle = container.querySelector<HTMLElement>(`[data-collapse="${name}"]`);
  const body = container.querySelector<HTMLElement>(
    `[data-collapse-body="${name}"]`,
  );

  const setOpen = (open: boolean): void => {
    if (!toggle || !body) {
      return;
    }
    body.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    onChange(open);
  };

  // Controls inside a header, like the history choices, do not open or close it.
  const fromControl = (event: Event): boolean =>
    event.target instanceof Element &&
    event.target.closest("[data-collapse-ignore]") !== null;

  toggle?.addEventListener("click", (event) => {
    if (!fromControl(event)) {
      setOpen(body?.hidden === true);
    }
  });
  toggle?.addEventListener("keydown", (event) => {
    if (fromControl(event)) {
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(body?.hidden === true);
    }
  });

  return setOpen;
}

// Older rows were stamped "YYYY-MM-DD HH:MM:SS", newer ones in ISO form; with
// the space made a "T" both sort as text.
const playedAtKey = (opponent: PlayerOpponent): string =>
  opponent.lastPlayedAt.replace(" ", "T");

function sortOpponents(
  opponents: PlayerOpponent[],
  sort: HistorySort,
): PlayerOpponent[] {
  const byRecent = (a: PlayerOpponent, b: PlayerOpponent) =>
    playedAtKey(b).localeCompare(playedAtKey(a));
  const byGames = (a: PlayerOpponent, b: PlayerOpponent) =>
    b.gamesPlayed - a.gamesPlayed;

  return [...opponents].sort((a, b) =>
    sort === "recent"
      ? byRecent(a, b) || byGames(a, b)
      : byGames(a, b) || byRecent(a, b),
  );
}

const renderOpponentRows = (opponents: PlayerOpponent[]): string =>
  opponents
    .map(
      (opponent) => `
        <div class="opponent-row">
          <div>
            ${
              opponent.opponentType === "user" && opponent.opponentId !== null
                ? `<a class="opponent-player-link" href="#/profile/${opponent.opponentId}">${escapeHtml(opponent.opponentName)}</a>`
                : `<strong>${escapeHtml(opponent.opponentName)}</strong>`
            }
          </div>

          <strong class="opponent-games">
            ${t(
              opponent.gamesPlayed === 1 ? "profile.oneGame" : "profile.games",
              { count: String(opponent.gamesPlayed) },
            )}
          </strong>
        </div>
      `,
    )
    .join("");

export async function renderProfilePage(
  container: HTMLElement,
  playerId?: number,
): Promise<void> {
  const token = localStorage.getItem("wizardToken");

  if (!token) {
    window.location.hash = "#/home";
    return;
  }

  const currentUser = await getCurrentUser();
  const ownProfile = playerId === undefined;

  const profile = playerId
    ? await getPlayerProfile(playerId)
    : {
        ...currentUser,
        stats: await getCurrentUserStats(),
        opponents: await getCurrentUserOpponents(),
      };

  const user = profile;

  // Friends and requests on one's own profile, the friendship on another's.
  // Also asked again in the background (see the end of this function).
  const loadSocial = async (): Promise<{
    friends: Friend[];
    friendRequests: FriendRequest[];
    friendStatus: FriendRelationshipStatus;
  }> => {
    if (ownProfile) {
      const [friends, friendRequests] = await Promise.all([
        getFriends(),
        getFriendRequests(),
      ]);
      return { friends, friendRequests, friendStatus: "none" };
    }

    const [status, currentFriends] = await Promise.all([
      getFriendStatus(user.id),
      getFriends(),
    ]);
    const normalizedStatus = String(status).trim().toLowerCase();
    const friendStatus: FriendRelationshipStatus = currentFriends.some(
      (friend) => friend.playerId === user.id,
    )
      ? "friend"
      : normalizedStatus === "pending"
        ? "pending"
        : normalizedStatus === "friend"
          ? "friend"
          : "none";
    return { friends: [], friendRequests: [], friendStatus };
  };

  let friends: Friend[] = [];
  let friendRequests: FriendRequest[] = [];
  let friendStatus: FriendRelationshipStatus = "none";
  let shownSocial = "";

  try {
    const social = await loadSocial();
    ({ friends, friendRequests, friendStatus } = social);
    shownSocial = JSON.stringify(social);
  } catch {
    // Social data is optional; the profile and opponent history still render.
  }
  const stats = profile.stats;
  const opponents = profile.opponents;

  const shortGamesFinished = stats.gamesFinished - stats.fullGamesFinished;
  const shortGamesWon = stats.gamesWon - stats.fullGamesWon;

  const fullWinRate =
    stats.fullGamesFinished > 0
      ? (stats.fullGamesWon / stats.fullGamesFinished) * 100
      : 0;

  // One prediction is made per round, so this is every round played in a
  // finished game.
  const roundsPlayed = stats.predictionsMade;

  const exactPredictionRate =
    stats.predictionsMade > 0
      ? (stats.exactPredictions / stats.predictionsMade) * 100
      : 0;

  const reliability =
    stats.gamesPlayed > 0
      ? Math.min(100, (stats.gamesFinished / stats.gamesPlayed) * 100)
      : 0;

  const playerLevel = getPlayerLevel(
    stats.fullGamesFinished,
    stats.peakTotalPoints,
  );

  const historyPrefs = loadHistoryPrefs();
  const socialPanels = loadSocialPanels();
  const visibleOpponents = (): PlayerOpponent[] =>
    sortOpponents(opponents, historyPrefs.sort).slice(0, historyPrefs.limit);

  const renderSearchResults = (results: PlayerSearchResult[]): string =>
    results.length === 0
      ? `<p class="profile-empty">${t("profile.noResults")}</p>`
      : results
          .map(
            (result) => `
              <div class="profile-search-result">
                <div>
                  <strong>${escapeHtml(result.displayName || result.username)}</strong>
                  <span>@${escapeHtml(result.username)}</span>
                </div>
                <a class="profile-action" href="#/profile/${result.id}">${t("profile.view")}</a>
              </div>
            `,
          )
          .join("");

  container.innerHTML = `
    <main class="profile-page">

      <div id="navbar-container"></div>

      <section class="profile-content">

        <div class="profile-heading">
          <div class="profile-identity-main">
            <p class="lobby-kicker">${t("profile.kicker")}</p>
            <div class="profile-title-row">
              <h1>${escapeHtml(user.displayName || user.username)}</h1>
              <span class="profile-level">
                ${t("profile.levelLine", { level: playerLevel })}
              </span>
            </div>
            <p class="profile-subtitle">@${escapeHtml(user.username)}</p>
          </div>
          <div class="profile-heading-actions">
            ${
              ownProfile
                ? `
                  <a
                    class="profile-action profile-take-seat"
                    id="profile-take-seat"
                    href="#/lobby"
                    hidden
                  >
                    ${t("profile.takeSeat")}
                  </a>

                  <button
                    class="profile-action"
                    type="button"
                    data-toggle-player-search
                  >
                    ${t("profile.findPlayers")}
                  </button>

                  <button
                    class="profile-action"
                    type="button"
                    data-scroll-friend-requests
                  >
                    ${t("profile.friendRequests")}
                    ${
                      friendRequests.length > 0
                        ? `<span class="profile-action-count">${friendRequests.length}</span>`
                        : ""
                    }
                  </button>
                `
                : friendStatus === "pending"
                  ? `<span class="profile-action profile-action-sent">${t("profile.requestSent")}</span>`
                  : `
                  <button
                    class="profile-action"
                    type="button"
                    data-friend-action="${user.id}"
                    ${friendStatus === "friend" ? "data-remove=true" : ""}
                  >
                    ${t(friendStatus === "friend" ? "profile.removeFriend" : "profile.addFriend")}
                  </button>
                `
            }
          </div>
        </div>

        <section class="profile-highlights" aria-label="${t("profile.highlights")}">

          <!-- Two groups, as wide as the Record and Social columns below. -->
          <div class="profile-highlight-group">
          <div class="profile-highlight profile-highlight-primary">
            <span>${t("profile.fullGames")}</span>
            <strong>${stats.fullGamesFinished}</strong>
            <small>${t("profile.fullGamesHint")}</small>
          </div>

          <div class="profile-highlight">
            <span>${t("profile.fullGamesWon")}</span>
            <strong>${stats.fullGamesWon}</strong>
            <small>${t("profile.victories")}</small>
          </div>

          <div class="profile-highlight">
            <span>${t("profile.winRate")}</span>
            <strong>${fullWinRate.toFixed(1)}%</strong>
            <small>${t("profile.winRateHint", { won: String(stats.fullGamesWon), total: String(stats.fullGamesFinished) })}</small>
          </div>
          </div>

          <div class="profile-highlight-group">
          <div class="profile-highlight">
            <span>${t("profile.peak")}</span>
            <strong>${stats.bestGameScore ?? "–"}</strong>
            <small>${t("profile.peakHint")}</small>
          </div>

          <div class="profile-highlight">
            <span>${t("profile.totalPoints")}</span>
            <strong>${stats.totalPoints}</strong>
            <small>${t("profile.totalPointsHint")}</small>
          </div>
          </div>

        </section>

        <section class="profile-detail-grid${ownProfile ? "" : " profile-detail-grid-single"}">
          <div class="profile-main-column">
            <article class="profile-card">
              <div class="profile-section-heading">
                <div>
                  <p class="profile-card-kicker">${t("profile.record")}</p>
                  <h2>${t("profile.skills")}</h2>
                </div>

                <span class="profile-rank">${playerLevel}</span>
              </div>

              <div class="profile-record-grid">

                <div class="profile-record-item">
                  <span>${t("profile.shortGames")}</span>
                  <strong>${shortGamesFinished}</strong>
                </div>

                <div class="profile-record-item">
                  <span>${t("profile.shortGamesWon")}</span>
                  <strong>${shortGamesWon}</strong>
                </div>

                <div class="profile-record-item">
                  <span>${t("profile.rounds")}</span>
                  <strong>${roundsPlayed}</strong>
                </div>

                <div class="profile-record-item">
                  <span>${t("profile.exact")}</span>
                  <strong>${stats.exactPredictions}</strong>
                </div>

                <div class="profile-record-item">
                  <span>${t("profile.accuracy")}</span>
                  <strong>${exactPredictionRate.toFixed(1)}%</strong>
                </div>

                <div class="profile-record-item">
                  <span>${t("profile.reliability")}</span>
                  <strong>${reliability.toFixed(1)}%</strong>
                </div>

              </div>
            </article>

          <section class="profile-card profile-opponents">
            <div
              class="profile-section-heading profile-collapse-toggle"
              ${collapseToggle("history", historyPrefs.open)}
            >
              <div>
                <p class="profile-card-kicker">${t("profile.history")}</p>
                <h2>${t("profile.opponents")}</h2>
              </div>

              <span class="profile-history-meta">
                ${
                  opponents.length === 0
                    ? ""
                    : `
                      <span class="profile-history-controls" data-collapse-ignore>
                        ${
                          opponents.length > HISTORY_LIMITS[0]
                            ? `
                              <label>
                                ${t("profile.show")}
                                <select class="profile-select" data-history-limit>
                                  ${HISTORY_LIMITS.map(
                                    (limit) =>
                                      `<option value="${limit}" ${limit === historyPrefs.limit ? "selected" : ""}>${limit}</option>`,
                                  ).join("")}
                                </select>
                              </label>
                            `
                            : ""
                        }
                        <select
                          class="profile-select"
                          data-history-sort
                          aria-label="${t("profile.opponents")}"
                        >
                          <option value="recent" ${historyPrefs.sort === "recent" ? "selected" : ""}>${t("profile.sortRecent")}</option>
                          <option value="games" ${historyPrefs.sort === "games" ? "selected" : ""}>${t("profile.sortMostGames")}</option>
                        </select>
                        </span>
                    `
                }
                <span class="profile-opponent-count">${t("profile.remembered", { count: String(opponents.length) })}</span>
                <span class="profile-chevron" aria-hidden="true"></span>
              </span>
            </div>

            <div class="profile-history-body" ${collapseBody("history", historyPrefs.open)}>

              ${
                opponents.length === 0
                  ? `
                    <p class="profile-empty">
                      ${t("profile.noGames")}
                    </p>
                  `
                  : `
                    <div class="opponents-list" data-opponents-list>
                      ${renderOpponentRows(visibleOpponents())}
                    </div>
                  `
              }
            </div>
          </section>
          </div>

          ${
            ownProfile
              ? `
                <div class="profile-side-column">
                  <section
                    class="profile-card profile-player-search"
                    id="profile-player-search"
                    hidden
                  >
                    <div class="profile-section-heading">
                      <div>
                        <p class="profile-card-kicker">${t("profile.social")}</p>
                        <h2>${t("profile.findPlayers")}</h2>
                      </div>
                    </div>
                    <form class="profile-search-form" id="profile-player-search-form">
                      <label class="profile-search-label" for="profile-player-search-input">${t("profile.searchLabel")}</label>
                      <div class="profile-search-controls">
                        <input id="profile-player-search-input" name="query" type="search" minlength="2" placeholder="${t("profile.searchPlaceholder")}" autocomplete="off" />
                        <button class="profile-action" type="submit">${t("profile.search")}</button>
                      </div>
                    </form>
                    <div class="profile-search-results" data-search-results>
                      <p class="profile-empty">${t("profile.searchHint")}</p>
                    </div>
                  </section>

                  <article class="profile-card profile-social-summary">

                    <div
                      class="profile-section-heading profile-collapse-toggle"
                      ${collapseToggle("social", socialPanels.social)}
                    >
                      <div>
                        <p class="profile-card-kicker">${t("profile.social")}</p>
                        <h2>${t("profile.players")}</h2>
                      </div>

                      <span class="profile-history-meta">
                        ${
                          friendRequests.length > 0
                            ? `<span class="profile-action-count">${friendRequests.length}</span>`
                            : ""
                        }
                        <span class="profile-chevron" aria-hidden="true"></span>
                      </span>
                    </div>

                    <div class="profile-social-body" ${collapseBody("social", socialPanels.social)}>
                      <div class="profile-social-summary-section">
                        <div
                          class="profile-social-summary-heading profile-collapse-toggle"
                          ${collapseToggle("friends", socialPanels.friends)}
                        >
                          <span>${t("profile.friends")}</span>
                          <span class="profile-social-count">
                            <strong>${friends.length}</strong>
                            <span class="profile-chevron profile-chevron-small" aria-hidden="true"></span>
                          </span>
                        </div>

                        <div class="profile-social-section-body" ${collapseBody("friends", socialPanels.friends)}>

                          ${
                            friends.length === 0
                              ? `<p class="profile-empty">${t("profile.noFriends")}</p>`
                              : `
                                ${
                                  friends.length > FRIEND_FILTER_FROM
                                    ? `
                                      <input
                                        class="profile-list-filter"
                                        type="search"
                                        data-friend-filter
                                        placeholder="${t("profile.filterFriends")}"
                                        aria-label="${t("profile.filterFriends")}"
                                        autocomplete="off"
                                      />
                                    `
                                    : ""
                                }
                                <div class="profile-mini-list profile-scroll-list">
                                  ${friends
                                    .map(
                                      (friend) => `
                                        <div
                                          class="profile-mini-friend"
                                          data-friend-name="${escapeHtml(
                                            `${friend.displayName} ${friend.username}`.toLowerCase(),
                                          )}"
                                        >
                                          <a
                                            class="profile-mini-player"
                                            href="#/profile/${friend.playerId}"
                                          >
                                            <span>
                                              ${escapeHtml(friend.displayName || friend.username)}
                                            </span>
                                            <small>@${escapeHtml(friend.username)}</small>
                                          </a>

                                          <button
                                            class="profile-action profile-action-muted"
                                            type="button"
                                            data-remove-friend="${friend.playerId}"
                                            data-name="${escapeHtml(friend.displayName || friend.username)}"
                                          >
                                            ${t("profile.remove")}
                                          </button>
                                        </div>
                                      `,
                                    )
                                    .join("")}
                                </div>
                                <p class="profile-empty" data-friend-no-match hidden>
                                  ${t("profile.noFriendMatch")}
                                </p>
                              `
                          }
                        </div>
                      </div>

                      <div
                        class="profile-social-summary-section"
                        id="profile-friend-requests"
                      >
                        <div
                          class="profile-social-summary-heading profile-collapse-toggle"
                          ${collapseToggle("requests", socialPanels.requests)}
                        >
                          <span>${t("profile.requests")}</span>
                          <span class="profile-social-count">
                            <strong>${friendRequests.length}</strong>
                            <span class="profile-chevron profile-chevron-small" aria-hidden="true"></span>
                          </span>
                        </div>

                        <div class="profile-social-section-body" ${collapseBody("requests", socialPanels.requests)}>

                          ${
                            friendRequests.length === 0
                              ? `<p class="profile-empty">${t("profile.noRequests")}</p>`
                              : `
                                <div class="profile-mini-list profile-scroll-list">
                                  ${friendRequests
                                    .map(
                                      (request) => `
                                        <div class="profile-mini-request">
                                          <a
                                            class="profile-mini-player"
                                            href="#/profile/${request.senderId}"
                                          >
                                            <span>
                                              ${
                                                escapeHtml(
                                                  request.senderDisplayName ||
                                                    request.senderUsername,
                                                )
                                              }
                                            </span>
                                            <small>@${escapeHtml(request.senderUsername)}</small>
                                          </a>

                                          <div class="profile-action-group">
                                            <button
                                              class="profile-action"
                                              type="button"
                                              data-accept-request="${request.id}"
                                            >
                                              ${t("profile.accept")}
                                            </button>

                                            <button
                                              class="profile-action profile-action-muted"
                                              type="button"
                                              data-reject-request="${request.id}"
                                            >
                                              ${t("profile.reject")}
                                            </button>
                                          </div>
                                        </div>
                                      `,
                                    )
                                    .join("")}
                                </div>
                              `
                          }
                        </div>
                      </div>
                    </div>

                  </article>
                </div>
              `
              : ""
          }

        </section>
      </section>

      <footer class="profile-footer">
        <span>Wizard Platform</span>
        <span>${t("profile.title")}</span>
      </footer>

    </main>
  `;

  const navbarContainer =
    container.querySelector<HTMLDivElement>("#navbar-container");

  if (navbarContainer) {
    renderNavbar(navbarContainer, currentUser);
  }

  const searchForm = container.querySelector<HTMLFormElement>(
    "#profile-player-search-form",
  );
  const searchInput = container.querySelector<HTMLInputElement>(
    "#profile-player-search-input",
  );
  const searchResults = container.querySelector<HTMLDivElement>(
    "[data-search-results]",
  );

  searchForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const query = searchInput?.value.trim() ?? "";

    if (!searchResults || query.length < 2) {
      if (searchResults) {
        searchResults.innerHTML =
          `<p class="profile-empty">${t("profile.tooShort")}</p>`;
      }
      return;
    }

    const submitButton = searchForm.querySelector<HTMLButtonElement>(
      "button[type=submit]",
    );
    if (submitButton) {
      submitButton.disabled = true;
    }
    searchResults.innerHTML =
      `<p class="profile-empty">${t("profile.searching")}</p>`;

    try {
      searchResults.innerHTML = renderSearchResults(
        await searchPlayers(query),
      );
    } catch (error) {
      // The server's message is not ours, so it is escaped like a name.
      searchResults.innerHTML = `<p class="profile-empty">${
        error instanceof Error ? escapeHtml(error.message) : t("profile.searchFailed")
      }</p>`;
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
  });

  const togglePlayerSearch = container.querySelector<HTMLButtonElement>(
    "[data-toggle-player-search]",
  );
  const playerSearchSection = container.querySelector<HTMLElement>(
    "#profile-player-search",
  );

  togglePlayerSearch?.addEventListener("click", () => {
    if (!playerSearchSection) {
      return;
    }

    playerSearchSection.hidden = !playerSearchSection.hidden;

    if (!playerSearchSection.hidden) {
      searchInput?.focus();
    }
  });

  setupCollapsible(container, "history", (open) => {
    historyPrefs.open = open;
    saveHistoryPrefs(historyPrefs);
  });

  const [openSocial, , openRequests] = (
    ["social", "friends", "requests"] as const
  ).map((panel) =>
    setupCollapsible(container, panel, (open) => {
      socialPanels[panel] = open;
      saveSocialPanels(socialPanels);
    }),
  );

  const scrollFriendRequests = container.querySelector<HTMLButtonElement>(
    "[data-scroll-friend-requests]",
  );

  scrollFriendRequests?.addEventListener("click", () => {
    openSocial(true);
    openRequests(true);

    const requestsSection = container.querySelector<HTMLElement>(
      "#profile-friend-requests",
    );

    requestsSection?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  });

  const opponentsList = container.querySelector<HTMLDivElement>(
    "[data-opponents-list]",
  );
  const historyLimit = container.querySelector<HTMLSelectElement>(
    "[data-history-limit]",
  );
  const historySort = container.querySelector<HTMLSelectElement>(
    "[data-history-sort]",
  );

  const redrawOpponents = (): void => {
    saveHistoryPrefs(historyPrefs);
    if (opponentsList) {
      opponentsList.innerHTML = renderOpponentRows(visibleOpponents());
    }
  };

  historyLimit?.addEventListener("change", () => {
    historyPrefs.limit = Number(historyLimit.value);
    redrawOpponents();
  });

  historySort?.addEventListener("change", () => {
    historyPrefs.sort = historySort.value === "games" ? "games" : "recent";
    redrawOpponents();
  });

  const friendFilter = container.querySelector<HTMLInputElement>(
    "[data-friend-filter]",
  );
  const friendNoMatch = container.querySelector<HTMLElement>(
    "[data-friend-no-match]",
  );

  friendFilter?.addEventListener("input", () => {
    const query = friendFilter.value.trim().toLowerCase();
    let shown = 0;

    container
      .querySelectorAll<HTMLElement>("[data-friend-name]")
      .forEach((row) => {
        row.hidden = !(row.dataset.friendName ?? "").includes(query);
        if (!row.hidden) shown += 1;
      });

    if (friendNoMatch) {
      friendNoMatch.hidden = shown > 0;
    }
  });

  const reloadProfile = async (): Promise<void> => {
    await renderProfilePage(container, playerId);
  };

  container.querySelectorAll<HTMLButtonElement>("[data-remove-friend]").forEach(
    (button) => {
      button.addEventListener("click", async () => {
        if (
          !window.confirm(
            t("profile.confirmRemove", { name: button.dataset.name ?? "" }),
          )
        ) {
          return;
        }
        button.disabled = true;
        try {
          await removeFriend(Number(button.dataset.removeFriend));
          await reloadProfile();
        } catch (error) {
          button.disabled = false;
          window.alert(error instanceof Error ? error.message : t("profile.removeFailed"));
        }
      });
    },
  );

  container.querySelectorAll<HTMLButtonElement>("[data-accept-request]").forEach(
    (button) => {
      button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          await acceptFriendRequest(Number(button.dataset.acceptRequest));
          await reloadProfile();
        } catch (error) {
          button.disabled = false;
          window.alert(error instanceof Error ? error.message : t("profile.acceptFailed"));
        }
      });
    },
  );

  container.querySelectorAll<HTMLButtonElement>("[data-reject-request]").forEach(
    (button) => {
      button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          await rejectFriendRequest(Number(button.dataset.rejectRequest));
          await reloadProfile();
        } catch (error) {
          button.disabled = false;
          window.alert(error instanceof Error ? error.message : t("profile.rejectFailed"));
        }
      });
    },
  );

  const friendAction = container.querySelector<HTMLButtonElement>("[data-friend-action]");
  friendAction?.addEventListener("click", async () => {
    friendAction.disabled = true;
    try {
      if (friendAction.dataset.remove !== undefined) {
        await removeFriend(Number(friendAction.dataset.friendAction));
      } else {
        await sendFriendRequest(Number(friendAction.dataset.friendAction));
      }
      await reloadProfile();
    } catch (error) {
      friendAction.disabled = false;
      try {
        const status = await getFriendStatus(
          Number(friendAction.dataset.friendAction),
        );
        if (status === "friend" || status === "pending") {
          await reloadProfile();
          return;
        }
      } catch {
        // Keep the original error when the status check also fails.
      }
      window.alert(
        error instanceof Error ? error.message : t("profile.updateFailed"),
      );
    }
  });

  // A game the player is seated in has started without them: the button to
  // its table shows before Find Players (see services/started-game.ts).
  const takeSeat =
    container.querySelector<HTMLAnchorElement>("#profile-take-seat");

  if (takeSeat) {
    watchStartedGame(takeSeat, currentUser.username, (game) => {
      takeSeat.hidden = game === null;

      if (game) {
        takeSeat.href = startedGameHash(game);
        takeSeat.title = t("nav.tipGameStarted", { room: game.name });
      }
    });
  }

  // New friend requests, and requests the other player answered, show up
  // without a reload: the friends are asked again every few seconds and the
  // page is drawn anew when they changed. Not while someone is typing or has
  // search results open, which a redraw would wipe; it stops once the page
  // is left or drawn anew.
  const page = container.querySelector<HTMLElement>(".profile-page");

  const scheduleSocialRefresh = (): void => {
    window.setTimeout(async () => {
      if (!page?.isConnected) {
        return;
      }

      const typing = document.activeElement?.matches("input, textarea, select");

      if (!document.hidden && !typing && !searchInput?.value) {
        try {
          if (JSON.stringify(await loadSocial()) !== shownSocial) {
            if (page.isConnected) {
              await reloadProfile();
            }
            return;
          }
        } catch {
          // Try again next time.
        }
      }

      scheduleSocialRefresh();
    }, SOCIAL_REFRESH_MS);
  };

  scheduleSocialRefresh();
}
