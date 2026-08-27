import {
  getCurrentUser,
  login,
  logout,
  register,
} from "../services/auth";
import { renderNavbar } from "../components/Navbar";

export function renderHomePage(container: HTMLElement): void {
  const token = localStorage.getItem("wizardToken");
  const isLoggedIn = Boolean(token);

  container.innerHTML = `
    <div class="page">
      ${renderNavbarHtml(isLoggedIn)}

      <main class="panel">
        <h1>Wizard Platform</h1>
        <p>Welcome to the Wizard card game platform.</p>

        ${
          isLoggedIn
            ? `
              <section class="panel">
                <h2>Welcome back</h2>
                <p id="home-user-status">Loading user...</p>
                <a href="#/lobby">Go to Lobby</a>
                <button id="home-logout-button" type="button">Log out</button>
              </section>
            `
            : `
              <section class="panel">
                <h2>Login</h2>
                <form id="login-form">
                  <label>
                    Username
                    <input name="username" type="text" required />
                  </label>

                  <label>
                    Password
                    <input name="password" type="password" required />
                  </label>

                  <button type="submit">Log in</button>
                </form>
                <p id="login-message"></p>
              </section>

              <section class="panel">
                <h2>Create account</h2>
                <form id="registration-form">
                  <label>
                    Username
                    <input name="username" type="text" required />
                  </label>

                  <label>
                    Display name
                    <input name="displayName" type="text" required />
                  </label>

                  <label>
                    Email
                    <input name="email" type="email" required />
                  </label>

                  <label>
                    Password
                    <input name="password" type="password" minlength="8" required />
                  </label>

                  <button type="submit">Register</button>
                </form>
                <p id="registration-message"></p>
              </section>
            `
        }
      </main>
    </div>
  `;

  const loginForm = document.querySelector<HTMLFormElement>("#login-form");
  const registrationForm =
    document.querySelector<HTMLFormElement>("#registration-form");
  const loginMessage =
    document.querySelector<HTMLParagraphElement>("#login-message");
  const registrationMessage = document.querySelector<HTMLParagraphElement>(
    "#registration-message",
  );
  const homeUserStatus =
    document.querySelector<HTMLParagraphElement>("#home-user-status");
  const homeLogoutButton =
    document.querySelector<HTMLButtonElement>("#home-logout-button");

  if (isLoggedIn) {
    loadLoggedInUser();
    homeLogoutButton?.addEventListener("click", () => {
      logout();
      window.location.hash = "#/home";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });

    return;
  }

  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(loginForm);
    const username = String(formData.get("username") ?? "");
    const password = String(formData.get("password") ?? "");

    try {
      await login(username, password);

      if (loginMessage) {
        loginMessage.textContent = "Login successful";
      }

      window.location.hash = "#/home";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    } catch (error) {
      if (loginMessage) {
        loginMessage.textContent =
          error instanceof Error ? error.message : "Login failed";
      }
    }
  });

  registrationForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(registrationForm);
    const username = String(formData.get("username") ?? "");
    const displayName = String(formData.get("displayName") ?? "");
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    try {
      const result = await register(username, displayName, email, password);

      if (registrationMessage) {
        registrationMessage.textContent =
          `Account created for ${result.username}`;
      }

      registrationForm.reset();
    } catch (error) {
      if (registrationMessage) {
        registrationMessage.textContent =
          error instanceof Error
            ? error.message
            : "Registration failed";
      }
    }
  });

  async function loadLoggedInUser(): Promise<void> {
    try {
      const user = await getCurrentUser();

      if (homeUserStatus) {
        homeUserStatus.textContent =
          `Logged in as ${user.displayName} (${user.username})`;
      }
    } catch {
      if (homeUserStatus) {
        homeUserStatus.textContent = "Session expired";
      }
    }
  }
}

function renderNavbarHtml(isLoggedIn: boolean): string {
  const links = [
    '<a href="#/home">Home</a>',
    isLoggedIn ? '<a href="#/profile">Profile</a>' : "",
  ].filter(Boolean);

  return `
    <nav class="navbar">
      ${links.join("")}
    </nav>
  `;
}