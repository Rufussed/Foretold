import {
  getCurrentUser,
  getCurrentUserOpponents,
  getCurrentUserStats,
} from "../services/auth";
import { renderNavbar } from "../components/Navbar";

export async function renderProfilePage(
  container: HTMLElement,
): Promise<void> {
  const token = localStorage.getItem("wizardToken");

  if (!token) {
    window.location.hash = "#/home";
    return;
  }

  const user = await getCurrentUser();
  const stats = await getCurrentUserStats();
  const opponents = await getCurrentUserOpponents();

  const winRate =
    stats.gamesFinished > 0
      ? (stats.gamesWon / stats.gamesFinished) * 100
      : 0;

  const exactPredictionRate =
    stats.predictionsMade > 0
      ? (stats.exactPredictions / stats.predictionsMade) * 100
      : 0;

  container.innerHTML = `
    <main class="profile-page">

      <div id="navbar-container"></div>

      <section class="profile-content">

        <div class="profile-heading">
          <p class="lobby-kicker">PLAYER PROFILE</p>
          <h1>${user.displayName || user.username}</h1>
          <p class="profile-subtitle">
            @${user.username}
          </p>
        </div>

        <section class="profile-grid">

          <article class="profile-card profile-identity">
            <p class="profile-card-kicker">ACCOUNT</p>

            <h2>Player Information</h2>

            <div class="profile-info-list">
              <div class="profile-info-row">
                <span>Username</span>
                <strong>${user.username}</strong>
              </div>

              <div class="profile-info-row">
                <span>Display name</span>
                <strong>${user.displayName}</strong>
              </div>

              <div class="profile-info-row">
                <span>Email</span>
                <strong>${user.email}</strong>
              </div>
            </div>
          </article>

          <article class="profile-card">
            <p class="profile-card-kicker">PERFORMANCE</p>

            <h2>Statistics</h2>

            <div class="profile-stat-grid">

              <div class="profile-stat">
                <span>Games played</span>
                <strong>${stats.gamesPlayed}</strong>
              </div>

              <div class="profile-stat">
                <span>Games finished</span>
                <strong>${stats.gamesFinished}</strong>
              </div>

              <div class="profile-stat">
                <span>Games won</span>
                <strong>${stats.gamesWon}</strong>
              </div>

              <div class="profile-stat">
                <span>Win rate</span>
                <strong>${winRate.toFixed(1)}%</strong>
              </div>

              <div class="profile-stat">
                <span>Total points</span>
                <strong>${stats.totalPoints}</strong>
              </div>

              <div class="profile-stat">
                <span>Tricks won</span>
                <strong>${stats.tricksWon}</strong>
              </div>

              <div class="profile-stat">
                <span>Predictions made</span>
                <strong>${stats.predictionsMade}</strong>
              </div>

              <div class="profile-stat">
                <span>Exact predictions</span>
                <strong>${stats.exactPredictions}</strong>
              </div>

              <div class="profile-stat">
                <span>Exact prediction rate</span>
                <strong>${exactPredictionRate.toFixed(1)}%</strong>
              </div>

              <div class="profile-stat">
                <span>Games created</span>
                <strong>${stats.gamesCreated}</strong>
              </div>

              <div class="profile-stat">
                <span>Created & finished</span>
                <strong>${stats.gamesCreatedFinished}</strong>
              </div>

            </div>
          </article>

        </section>

        <section class="profile-card profile-opponents">
          <div class="profile-section-heading">
            <div>
              <p class="profile-card-kicker">HISTORY</p>
              <h2>Opponents</h2>
            </div>

            <span class="profile-opponent-count">
              ${opponents.length}
              ${opponents.length === 1 ? "opponent" : "opponents"}
            </span>
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
                            <strong>${opponent.opponentName}</strong>
                            <span>
                              ${
                                opponent.opponentType === "bot"
                                  ? "Bot"
                                  : "Player"
                              }
                            </span>
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
    renderNavbar(navbarContainer, user);
  }
}