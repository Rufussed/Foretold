import {
  getCurrentUser,
  getCurrentUserOpponents,
  getCurrentUserStats,
  getPlayerProfile,
} from "../services/auth";
import { renderNavbar } from "../components/Navbar";

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

  const profile = playerId
    ? await getPlayerProfile(playerId)
    : {
        ...currentUser,
        stats: await getCurrentUserStats(),
        opponents: await getCurrentUserOpponents(),
      };

  const user = profile;
  const stats = profile.stats;
  const opponents = profile.opponents;
  const email = "email" in profile ? profile.email : "";

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

  container.innerHTML = `
    <main class="profile-page">

      <div id="navbar-container"></div>

      <section class="profile-content">

        <div class="profile-heading">
          <div>
            <p class="lobby-kicker">PLAYER PROFILE</p>
            <h1>${user.displayName || user.username}</h1>
            <p class="profile-subtitle">@${user.username}</p>
          </div>
          <p class="profile-heading-note">
            <strong>${stats.gamesFinished}</strong>
            completed
            ${stats.gamesFinished === 1 ? "game" : "games"}
          </p>
        </div>

        <section class="profile-highlights" aria-label="Profile highlights">
          <div class="profile-highlight profile-highlight-primary">
            <span>Win rate</span>
            <strong>${winRate.toFixed(1)}%</strong>
            <small>${stats.gamesWon} wins</small>
          </div>

          <div class="profile-highlight">
            <span>Games won</span>
            <strong>${stats.gamesWon}</strong>
            <small>of ${stats.gamesFinished} finished</small>
          </div>

          <div class="profile-highlight">
            <span>Total points</span>
            <strong>${stats.totalPoints}</strong>
            <small>Overall game score</small>
          </div>

          <div class="profile-highlight">
            <span>Prediction accuracy</span>
            <strong>${exactPredictionRate.toFixed(1)}%</strong>
            <small>${stats.exactPredictions} exact calls</small>
          </div>
        </section>

        <section class="profile-grid">

          <article class="profile-card profile-identity">
            <p class="profile-card-kicker">ACCOUNT</p>

            <h2>Player details</h2>

            <div class="profile-info-list">
              <div class="profile-info-row">
                <span>Username</span>
                <strong>${user.username}</strong>
              </div>

              <div class="profile-info-row">
                <span>Display name</span>
                <strong>${user.displayName}</strong>
              </div>
              ${
                !playerId
                  ? `
                    <div class="profile-info-row">
                      <span>Email</span>
                      <strong>${email}</strong>
                    </div>
                  `
                  : ""
              }
            </div>
          </article>

          <article class="profile-card">
            <div class="profile-card-heading">
              <div>
                <p class="profile-card-kicker">PERFORMANCE</p>
                <h2>Wizard skills</h2>
              </div>
              <!-- TODO: replace this placeholder with rank logic based on skill and games played. -->
              <span class="profile-rank">Novice</span>
            </div>

            <div class="profile-stat-grid">

              <div class="profile-stat">
                <span>Rounds won</span>
                <strong>${stats.exactPredictions}</strong>
              </div>

              <div class="profile-stat">
                <span>Predictions made</span>
                <strong>${stats.predictionsMade}</strong>
              </div>

              <div class="profile-stat">
                <span>Reliability</span>
                <strong>${reliability.toFixed(1)}%</strong>
              </div>

            </div>
          </article>

        </section>

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
}