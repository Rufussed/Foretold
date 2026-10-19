import {
  getCurrentUser,
  login,
  logout,
  register,
} from "../services/auth";

export function renderLoginPage(container: HTMLElement): void {
  container.innerHTML = `
    <main class="page">
      <h1>Foretold</h1>

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
            Last name
            <input name="lastName" type="text" required />
          </label>

          <label>
            Date of birth
            <input name="birthDate" type="date" required />
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

      <section class="panel">
        <h2>Current user</h2>
        <p id="user-status">Not logged in</p>
        <button id="logout-button" type="button">Log out</button>
      </section>
    </main>
  `;

  const loginForm = document.querySelector<HTMLFormElement>("#login-form");
  const registrationForm =
    document.querySelector<HTMLFormElement>("#registration-form");
  const loginMessage =
    document.querySelector<HTMLParagraphElement>("#login-message");
  const registrationMessage = document.querySelector<HTMLParagraphElement>(
    "#registration-message",
  );
  const userStatus =
    document.querySelector<HTMLParagraphElement>("#user-status");
  const logoutButton =
    document.querySelector<HTMLButtonElement>("#logout-button");

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

      await updateUserStatus();
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
    const lastName = String(formData.get("lastName") ?? "");
    const birthDate = String(formData.get("birthDate") ?? "");
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    try {
      const result = await register(
        username,
        lastName,
        birthDate,
        email,
        password,
      );

      if (registrationMessage) {
        registrationMessage.textContent =
          `Account created for ${result.user.username}`;
      }

      registrationForm.reset();
      await updateUserStatus();
    } catch (error) {
      if (registrationMessage) {
        registrationMessage.textContent =
          error instanceof Error
            ? error.message
            : "Registration failed";
      }
    }
  });

  logoutButton?.addEventListener("click", () => {
    logout();

    if (userStatus) {
      userStatus.textContent = "Not logged in";
    }

    if (loginMessage) {
      loginMessage.textContent = "Logged out";
    }
  });

  async function updateUserStatus(): Promise<void> {
    try {
      const user = await getCurrentUser();

      if (userStatus) {
        userStatus.textContent =
          `Logged in as ${user.displayName} (${user.username})`;
      }
    } catch {
      if (userStatus) {
        userStatus.textContent = "Not logged in";
      }
    }
  }

  void updateUserStatus();
}