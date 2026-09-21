import {
  getCurrentUser,
  getCurrentUserOpponents,
  getCurrentUserStats,
  logout,
} from "../services/auth";

export async function renderProfilePage(container: HTMLElement): Promise<void> {
  const token = localStorage.getItem("wizardToken");

  if (!token) {
    window.location.hash = "#/home";
    return;
  }

  const user = await getCurrentUser();
  const stats = await getCurrentUserStats();
  const opponents = await getCurrentUserOpponents();

  container.innerHTML = `
    <div class="page">
      <nav class="navbar">
        <a href="#/home">Home</a>
        <button id="profile-logout" type="button">Log out</button>
      </nav>

      <main class="panel">
        <h1>Profile</h1>
        <p><strong>Username:</strong> ${user.username}</p>
        <p><strong>Display name:</strong> ${user.displayName}</p>
        <p><strong>Email:</strong> ${user.email}</p>
        <h2>Statistics</h2>
        <p><strong>Games played:</strong> ${stats.gamesPlayed}</p>
        <p><strong>Games finished:</strong> ${stats.gamesFinished}</p>
        <p><strong>Games won:</strong> ${stats.gamesWon}</p>
        <p><strong>Total points:</strong> ${stats.totalPoints}</p>
        <p><strong>Tricks won:</strong> ${stats.tricksWon}</p>
        <p><strong>Predictions made:</strong> ${stats.predictionsMade}</p>
        <p><strong>Exact predictions:</strong> ${stats.exactPredictions}</p>
        <p><strong>Games created:</strong> ${stats.gamesCreated}</p>
        <p><strong>Games created and finished:</strong> ${stats.gamesCreatedFinished}</p>
        <h2>Opponents</h2>

        ${
          opponents.length === 0
            ? "<p>No games played yet.</p>"
            : opponents
                .map(
                  (opponent) => `
                    <p>
                      <strong>${opponent.opponentName}</strong>
                      — ${opponent.gamesPlayed}
                      ${opponent.gamesPlayed === 1 ? "game" : "games"}
                    </p>
                  `,
                )
                .join("")
        }
      </main>
    </div>
  `;

  const logoutButton =
    container.querySelector<HTMLButtonElement>("#profile-logout");

  logoutButton?.addEventListener("click", () => {
    logout();
    window.location.hash = "#/home";
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
}