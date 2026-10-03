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

function getPlayerLevel(
  gamesFinished: number,
  gamesWon: number,
): string {
  if (gamesFinished >= 75 && gamesWon >= 30) {
    return "Expert";
  }

  if (gamesFinished >= 30 && gamesWon >= 12) {
    return "Advanced";
  }

  if (gamesFinished >= 10 && gamesWon >= 3) {
    return "Intermediate";
  }

  return "Novice";
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

  const winRate =
    stats.gamesFinished > 0
      ? (stats.gamesWon / stats.gamesFinished) * 100
      : 0;

  const exactPredictionRate =
    stats.predictionsMade > 0
      ? (stats.exactPredictions / stats.predictionsMade) * 100
      : 0;

  const reliability =
    stats.gamesPlayed > 0
      ? Math.min(100, (stats.gamesFinished / stats.gamesPlayed) * 100)
      : 0;

  const playerLevel = getPlayerLevel(
    stats.gamesFinished,
    stats.gamesWon,
  );

  const renderSearchResults = (results: PlayerSearchResult[]): string =>
    results.length === 0
      ? `<p class="profile-empty">No players found.</p>`
      : results
          .map(
            (result) => `
              <div class="profile-search-result">
                <div>
                  <strong>${result.displayName || result.username}</strong>
                  <span>@${result.username}</span>
                </div>
                <a class="profile-action" href="#/profile/${result.id}">View Profile</a>
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
            <p class="lobby-kicker">PLAYER PROFILE</p>
            <div class="profile-title-row">
              <h1>${user.displayName || user.username}</h1>
              <span class="profile-level">
                Wizard Player · ${playerLevel}
              </span>
            </div>
            <p class="profile-subtitle">@${user.username}</p>
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
                    Find Players
                  </button>

                  <button
                    class="profile-action"
                    type="button"
                    data-scroll-friend-requests
                  >
                    Friend Requests
                    ${
                      friendRequests.length > 0
                        ? `<span class="profile-action-count">${friendRequests.length}</span>`
                        : ""
                    }
                  </button>
                `
                : `
                  <button
                    class="profile-action"
                    type="button"
                    data-friend-action="${user.id}"
                    ${friendStatus === "friend" ? "data-remove=true" : ""}
                    ${friendStatus === "pending" ? "disabled" : ""}
                  >
                    ${
                      friendStatus === "friend"
                        ? "Remove Friend"
                        : friendStatus === "pending"
                          ? "Request Pending"
                          : "Add Friend"
                    }
                  </button>
                `
            }
          </div>
        </div>

        <section class="profile-highlights" aria-label="Profile highlights">

          <div class="profile-highlight profile-highlight-primary">
            <span>Games finished</span>
            <strong>${stats.gamesFinished}</strong>
            <small>Completed games</small>
          </div>

          <div class="profile-highlight">
            <span>Games won</span>
            <strong>${stats.gamesWon}</strong>
            <small>Victories</small>
          </div>

          <div class="profile-highlight">
            <span>Win rate</span>
            <strong>${winRate.toFixed(1)}%</strong>
            <small>${stats.gamesWon} wins</small>
          </div>

          <div class="profile-highlight">
            <span>Total points</span>
            <strong>${stats.totalPoints}</strong>
            <small>Overall score</small>
          </div>

        </section>

        <section class="profile-detail-grid">

          <article class="profile-card">
            <div class="profile-section-heading">
              <div>
                <p class="profile-card-kicker">RECORD</p>
                <h2>Wizard Skills</h2>
              </div>

              <span class="profile-rank">${playerLevel}</span>
            </div>

            <div class="profile-record-grid">

              <div class="profile-record-item">
                <span>Games finished</span>
                <strong>${stats.gamesFinished}</strong>
              </div>

              <div class="profile-record-item">
                <span>Games won</span>
                <strong>${stats.gamesWon}</strong>
              </div>

              <div class="profile-record-item">
                <span>Predictions made</span>
                <strong>${stats.predictionsMade}</strong>
              </div>

              <div class="profile-record-item">
                <span>Exact predictions</span>
                <strong>${stats.exactPredictions}</strong>
              </div>

              <div class="profile-record-item">
                <span>Prediction accuracy</span>
                <strong>${exactPredictionRate.toFixed(1)}%</strong>
              </div>

              <div class="profile-record-item">
                <span>Reliability</span>
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
                      <p class="profile-card-kicker">SOCIAL</p>
                      <h2>Players</h2>
                    </div>
                  </div>

                  <div class="profile-social-summary-section">
                    <div class="profile-social-summary-heading">
                      <span>Friends</span>
                      <strong>${friends.length}</strong>
                    </div>

                    ${
                      friends.length === 0
                        ? `<p class="profile-empty">No friends yet.</p>`
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
                                      ${friend.displayName || friend.username}
                                    </span>
                                    <small>@${friend.username}</small>
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
                      <span>Friend requests</span>
                      <strong>${friendRequests.length}</strong>
                    </div>

                    ${
                      friendRequests.length === 0
                        ? `<p class="profile-empty">No pending requests.</p>`
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
                                          request.senderDisplayName ||
                                          request.senderUsername
                                        }
                                      </span>
                                      <small>@${request.senderUsername}</small>
                                    </a>

                                    <div class="profile-action-group">
                                      <button
                                        class="profile-action"
                                        type="button"
                                        data-accept-request="${request.id}"
                                      >
                                        Accept
                                      </button>

                                      <button
                                        class="profile-action profile-action-muted"
                                        type="button"
                                        data-reject-request="${request.id}"
                                      >
                                        Reject
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
              <p class="profile-card-kicker">SOCIAL</p>
              <h2>Find Players</h2>
            </div>
          </div>
          <form class="profile-search-form" id="profile-player-search-form">
            <label class="profile-search-label" for="profile-player-search-input">Search username</label>
            <div class="profile-search-controls">
              <input id="profile-player-search-input" name="query" type="search" minlength="2" placeholder="Search username..." autocomplete="off" />
              <button class="profile-action" type="submit">Search</button>
            </div>
          </form>
          <div class="profile-search-results" data-search-results>
            <p class="profile-empty">Search for a username to find players.</p>
          </div>
        </section>

            `
            : ""
        }

        <section class="profile-card profile-opponents">
          <div class="profile-section-heading">
            <div>
              <p class="profile-card-kicker">HISTORY</p>
              <h2>Recent opponents</h2>
            </div>

            <span class="profile-opponent-count">${opponents.length} / 100 remembered</span>
          </div>

          ${
            opponents.length === 0
              ? `
                <p class="profile-empty">
                  No games played yet.
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
                                ? `<a class="opponent-player-link" href="#/profile/${opponent.opponentId}">${opponent.opponentName}</a>`
                                : `<strong>${opponent.opponentName}</strong>`
                            }
                          </div>

                          <strong class="opponent-games">
                            ${opponent.gamesPlayed}
                            ${
                              opponent.gamesPlayed === 1
                                ? "game"
                                : "games"
                            }
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
        <span>Player Profile</span>
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
          '<p class="profile-empty">Enter at least 2 characters.</p>';
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
      '<p class="profile-empty">Searching players...</p>';

    try {
      searchResults.innerHTML = renderSearchResults(
        await searchPlayers(query),
      );
    } catch (error) {
      searchResults.innerHTML = `<p class="profile-empty">${
        error instanceof Error ? error.message : "Could not search players"
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
          window.alert(error instanceof Error ? error.message : "Could not remove friend");
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
          window.alert(error instanceof Error ? error.message : "Could not accept request");
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
          window.alert(error instanceof Error ? error.message : "Could not reject request");
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
        error instanceof Error ? error.message : "Could not update friendship",
      );
    }
  });
}