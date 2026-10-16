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
  let friends: Friend[] = [];
  let friendRequests: FriendRequest[] = [];
  let friendStatus: FriendRelationshipStatus = "none";

  try {
    if (ownProfile) {
      [friends, friendRequests] = await Promise.all([
        getFriends(),
        getFriendRequests(),
      ]);
    } else {
      const [status, currentFriends] = await Promise.all([
        getFriendStatus(user.id),
        getFriends(),
      ]);
      const normalizedStatus = String(status).trim().toLowerCase();
      friendStatus = currentFriends.some(
        (friend) => friend.playerId === user.id,
      )
        ? "friend"
        : normalizedStatus === "pending"
          ? "pending"
          : normalizedStatus === "friend"
            ? "friend"
            : "none";
    }
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

          <div class="profile-highlight">
            <span>${t("profile.peak")}</span>
            <strong>${stats.peakTotalPoints}</strong>
            <small>${t("profile.peakHint")}</small>
          </div>

          <div class="profile-highlight">
            <span>${t("profile.totalPoints")}</span>
            <strong>${stats.totalPoints}</strong>
            <small>${t("profile.totalPointsHint")}</small>
          </div>

        </section>

        <section class="profile-detail-grid">

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

          ${
            ownProfile
              ? `
                <article class="profile-card profile-social-summary">

                  <div class="profile-section-heading">
                    <div>
                      <p class="profile-card-kicker">${t("profile.social")}</p>
                      <h2>${t("profile.players")}</h2>
                    </div>
                  </div>

                  <div class="profile-social-summary-section">
                    <div class="profile-social-summary-heading">
                      <span>${t("profile.friends")}</span>
                      <strong>${friends.length}</strong>
                    </div>

                    ${
                      friends.length === 0
                        ? `<p class="profile-empty">${t("profile.noFriends")}</p>`
                        : `
                          <div class="profile-mini-list">
                            ${friends
                              .slice(0, 4)
                              .map(
                                (friend) => `
                                  <a
                                    class="profile-mini-player"
                                    href="#/profile/${friend.playerId}"
                                  >
                                    <span>
                                      ${escapeHtml(friend.displayName || friend.username)}
                                    </span>
                                    <small>@${escapeHtml(friend.username)}</small>
                                  </a>
                                `,
                              )
                              .join("")}
                          </div>
                        `
                    }
                  </div>

                  <div
                    class="profile-social-summary-section"
                    id="profile-friend-requests"
                  >
                    <div class="profile-social-summary-heading">
                      <span>${t("profile.requests")}</span>
                      <strong>${friendRequests.length}</strong>
                    </div>

                    ${
                      friendRequests.length === 0
                        ? `<p class="profile-empty">${t("profile.noRequests")}</p>`
                        : `
                          <div class="profile-mini-list">
                            ${friendRequests
                              .slice(0, 3)
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

                </article>
              `
              : ""
          }

        </section>

        ${
          ownProfile
            ? `
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

            `
            : ""
        }

        <section class="profile-card profile-opponents">
          <div class="profile-section-heading">
            <div>
              <p class="profile-card-kicker">${t("profile.history")}</p>
              <h2>${t("profile.opponents")}</h2>
            </div>

            <span class="profile-opponent-count">${t("profile.remembered", { count: String(opponents.length) })}</span>
          </div>

          ${
            opponents.length === 0
              ? `
                <p class="profile-empty">
                  ${t("profile.noGames")}
                </p>
              `
              : `
                <div class="opponents-list">
                  ${opponents
                    .map(
                      (opponent) => `
                        <div class="opponent-row">
                          <div>
                            ${
                              opponent.opponentType === "user" &&
                              opponent.opponentId !== null
                                ? `<a class="opponent-player-link" href="#/profile/${opponent.opponentId}">${escapeHtml(opponent.opponentName)}</a>`
                                : `<strong>${escapeHtml(opponent.opponentName)}</strong>`
                            }
                          </div>

                          <strong class="opponent-games">
                            ${t(
                              opponent.gamesPlayed === 1
                                ? "profile.oneGame"
                                : "profile.games",
                              { count: String(opponent.gamesPlayed) },
                            )}
                          </strong>
                        </div>
                      `,
                    )
                    .join("")}
                </div>
              `
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

  const scrollFriendRequests = container.querySelector<HTMLButtonElement>(
    "[data-scroll-friend-requests]",
  );

  scrollFriendRequests?.addEventListener("click", () => {
    const requestsSection = container.querySelector<HTMLElement>(
      "#profile-friend-requests",
    );

    requestsSection?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  });

  const reloadProfile = async (): Promise<void> => {
    await renderProfilePage(container, playerId);
  };

  container.querySelectorAll<HTMLButtonElement>("[data-remove-friend]").forEach(
    (button) => {
      button.addEventListener("click", async () => {
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
}