import {
  createGuestGame,
  getCurrentUser,
  login,
  logout,
  register,
} from "../services/auth";

type Panel = "login" | "signup" | "about" | "rules" | "news" | "contact" | "legal" | null;

export async function renderHomePage(container: HTMLElement): Promise<void> {
  const token = localStorage.getItem("wizardToken");
  const isLoggedIn = Boolean(token);
  const currentUser = isLoggedIn ? await getCurrentUser() : null;

  let activePanel: Panel = null;

  function render(): void {
    container.innerHTML = `
    <main
      class="home-page"
    >
        <div class="home-scene-shade"></div>

        <header class="home-topbar">
          <a class="home-brand" href="#/home">
            <img
              class="home-logo"
              src="/wizardLogo.png"
              alt="Wizard"
            />
          </a>

          <nav class="home-top-nav" aria-label="Main navigation">
            <button type="button" data-panel="about">
              About
            </button>

            <span></span>

            <button type="button" data-panel="rules">
              Rules
            </button>

            <span></span>

            <button type="button" data-panel="news">
              News
            </button>

          </nav>

          <div class="home-account-actions">
            ${
              isLoggedIn
                ? `
                  <a
                    class="home-account-button"
                    href="#/profile"
                  >
                    ${currentUser?.displayName || currentUser?.username}
                  </a>

                  <button
                    type="button"
                    class="home-account-button home-signup-button"
                    id="home-logout-button"
                  >
                    Log out
                  </button>
                `
                : `
                  <button
                    type="button"
                    class="home-account-button"
                    data-panel="login"
                  >
                    Log in
                  </button>

                  <button
                    type="button"
                    class="home-account-button home-signup-button"
                    data-panel="signup"
                  >
                    Sign up
                  </button>
                `
            }
          </div>
        </header>

        <section class="home-table-action">
          <button
            type="button"
            class="home-play-button"
            id="home-play-button"
          >
            <span class="home-button-flare"></span>
            <span>Play Now</span>
          </button>
        </section>

        <footer class="home-footer">
          <p>Wizard Platform</p>
          <button type="button" data-panel="legal">
            Copyright & Legal
          </button>

          <button type="button" data-panel="contact">
            Contact
          </button>
        </footer>

        <div
          id="home-panel-container"
          ${
            activePanel === null
              ? 'hidden'
              : ""
          }
        ></div>
      </main>
    `;

    attachHomeEvents();

    if (activePanel !== null) {
      renderPanel();
    }

    if (isLoggedIn) {
      const logoutButton =
        document.querySelector<HTMLButtonElement>(
          "#home-logout-button",
        );

      logoutButton?.addEventListener("click", () => {
        logout();
        window.location.hash = "#/home";
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      });
    }
  }

  function renderPanel(): void {
    const panelContainer =
      document.querySelector<HTMLDivElement>(
        "#home-panel-container",
      );

    if (!panelContainer || activePanel === null) {
      return;
    }

    panelContainer.hidden = false;

    if (activePanel === "login") {
      panelContainer.innerHTML = renderLoginPanel();
      attachLoginEvents();
      return;
    }

    if (activePanel === "signup") {
      panelContainer.innerHTML = renderSignupPanel();
      attachSignupEvents();
      return;
    }

    if (activePanel === "about") {
      panelContainer.innerHTML = renderInfoPanel(
        "About",
        "The Wizard card game platform.",
        `
          <p class="home-modal-copy">
            Passionate for the card game Wizard. Two students software developers decided to create a Wizard game platform.
          </p>
        `,
      );
      attachCloseEvent();
      return;
    }

    if (activePanel === "rules") {
      panelContainer.innerHTML = renderInfoPanel(
        "Rules",
        "The basics of Wizard.",
        `
          <ul class="home-rule-list">
            <li>
              <span>01</span>
              Predict how many tricks you will win.
            </li>
            <li>
              <span>02</span>
              Play one card during each trick.
            </li>
            <li>
              <span>03</span>
              Follow the lead suit whenever possible.
            </li>
            <li>
              <span>04</span>
              The highest card of the trump suit wins.
            </li>
            <li>
              <span>05</span>
              Score points by matching your prediction.
            </li>
          </ul>
        `,
      );
      attachCloseEvent();
      return;
    }

    if (activePanel === "news") {
      panelContainer.innerHTML = renderInfoPanel(
        "News",
        "Wizard Platform updates.",
        `
          <p class="home-modal-copy">
            News and game updates will appear here.
          </p>
        `,
      );
      attachCloseEvent();
      return;
    }

    if (activePanel === "contact") {
      panelContainer.innerHTML = renderInfoPanel(
        "Contact",
        "Wizard Platform",
        `
          <p class="home-modal-copy">
            Questions, feedback, or suggestions?
          </p>

          <p class="home-modal-copy">
            Contact information will be added here.
          </p>
        `,
      );
      attachCloseEvent();
      return;
    }

    if (activePanel === "legal") {
      panelContainer.innerHTML = renderInfoPanel(
        "Copyright & Legal",
        "Wizard Platform",
        `
          <p class="home-modal-copy">
            Wizard Platform is an educational project created by student developers.
          </p>

          <p class="home-modal-copy">
            All game content and visual assets are used for this project.
          </p>
        `,
      );
      attachCloseEvent();
    }
  }

  function renderLoginPanel(): string {
    return `
      <div class="home-modal-backdrop">
        <section
          class="home-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="home-login-title"
        >
          <button
            type="button"
            class="home-close-button"
            id="home-close-button"
            aria-label="Close"
          >
            <span></span>
            <span></span>
          </button>

          <p class="home-modal-kicker">Welcome back</p>

          <h2 id="home-login-title">Log in</h2>

          <form id="home-login-form" class="home-auth-form">
            <label>
              Username
              <input
                name="username"
                type="text"
                autocomplete="username"
                required
              />
            </label>

            <label>
              Password
              <input
                name="password"
                type="password"
                autocomplete="current-password"
                required
              />
            </label>

            <button
              type="submit"
              class="home-modal-primary"
            >
              Log in
            </button>
          </form>

          <p
            id="home-login-message"
            class="home-auth-message"
          ></p>

          <button
            type="button"
            class="home-switch-auth"
            id="home-switch-to-signup"
          >
            Need an account? Sign up
          </button>
        </section>
      </div>
    `;
  }

  function renderSignupPanel(): string {
    return `
      <div class="home-modal-backdrop">
        <section
          class="home-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="home-signup-title"
        >
          <button
            type="button"
            class="home-close-button"
            id="home-close-button"
            aria-label="Close"
          >
            <span></span>
            <span></span>
          </button>

          <p class="home-modal-kicker">Join the table</p>

          <h2 id="home-signup-title">Create account</h2>

          <form id="home-signup-form" class="home-auth-form">
            <label>
              Username
              <input
                name="username"
                type="text"
                autocomplete="username"
                required
              />
            </label>

            <label>
              Display name
              <input
                name="displayName"
                type="text"
                required
              />
            </label>

            <label>
              Email
              <input
                name="email"
                type="email"
                autocomplete="email"
                required
              />
            </label>

            <label>
              Password
              <input
                name="password"
                type="password"
                autocomplete="new-password"
                minlength="8"
                required
              />
            </label>

            <button
              type="submit"
              class="home-modal-primary"
            >
              Sign up
            </button>
          </form>

          <p
            id="home-signup-message"
            class="home-auth-message"
          ></p>

          <button
            type="button"
            class="home-switch-auth"
            id="home-switch-to-login"
          >
            Already have an account? Log in
          </button>
        </section>
      </div>
    `;
  }

  function renderInfoPanel(
    title: string,
    kicker: string,
    content: string,
  ): string {
    return `
      <div class="home-modal-backdrop">
        <section
          class="home-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="home-info-title"
        >
          <button
            type="button"
            class="home-close-button"
            id="home-close-button"
            aria-label="Close"
          >
            <span></span>
            <span></span>
          </button>

          <p class="home-modal-kicker">
            ${kicker}
          </p>

          <h2 id="home-info-title">
            ${title}
          </h2>

          ${content}
        </section>
      </div>
    `;
  }

  function attachHomeEvents(): void {
    container
      .querySelectorAll<HTMLButtonElement>(
        "[data-panel]",
      )
      .forEach((button) => {
        button.addEventListener("click", () => {
          const panel = button.dataset.panel as Panel;

          activePanel = panel;
          renderPanel();
        });
      });

    const playButton =
      document.querySelector<HTMLButtonElement>(
        "#home-play-button",
      );

    playButton?.addEventListener("click", async () => {
      if (localStorage.getItem("wizardToken")) {
        window.location.hash = "#/lobby";
        return;
      }

      playButton.disabled = true;

      try {
        const guestGame = await createGuestGame();
        window.location.hash = `#/room/${guestGame.roomId}`;
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : "Could not start guest game",
        );
        playButton.disabled = false;
      }
    });
  }

  function attachCloseEvent(): void {
    const closeButton =
      document.querySelector<HTMLButtonElement>(
        "#home-close-button",
      );

    closeButton?.addEventListener("click", closePanel);

    const backdrop =
      document.querySelector<HTMLDivElement>(
        ".home-modal-backdrop",
      );

    backdrop?.addEventListener("click", (event) => {
      if (event.target === backdrop) {
        closePanel();
      }
    });
  }

  function closePanel(): void {
    activePanel = null;

    const panelContainer =
      document.querySelector<HTMLDivElement>(
        "#home-panel-container",
      );

    if (panelContainer) {
      panelContainer.hidden = true;
      panelContainer.innerHTML = "";
    }
  }

  function attachLoginEvents(): void {
    attachCloseEvent();

    const switchButton =
      document.querySelector<HTMLButtonElement>(
        "#home-switch-to-signup",
      );

    switchButton?.addEventListener("click", () => {
      activePanel = "signup";
      renderPanel();
    });

    const form =
      document.querySelector<HTMLFormElement>(
        "#home-login-form",
      );

    const message =
      document.querySelector<HTMLParagraphElement>(
        "#home-login-message",
      );

    form?.addEventListener("submit", async (event) => {
      event.preventDefault();

      const formData = new FormData(form);

      const username = String(
        formData.get("username") ?? "",
      );

      const password = String(
        formData.get("password") ?? "",
      );

      try {
        await login(username, password);

        closePanel();

        window.location.hash = "#/home";
        window.dispatchEvent(
          new HashChangeEvent("hashchange"),
        );
      } catch (error) {
        if (message) {
          message.textContent =
            error instanceof Error
              ? error.message
              : "Login failed";
        }
      }
    });
  }

  function attachSignupEvents(): void {
    attachCloseEvent();

    const switchButton =
      document.querySelector<HTMLButtonElement>(
        "#home-switch-to-login",
      );

    switchButton?.addEventListener("click", () => {
      activePanel = "login";
      renderPanel();
    });

    const form =
      document.querySelector<HTMLFormElement>(
        "#home-signup-form",
      );

    const message =
      document.querySelector<HTMLParagraphElement>(
        "#home-signup-message",
      );

    form?.addEventListener("submit", async (event) => {
      event.preventDefault();

      const formData = new FormData(form);

      const username = String(
        formData.get("username") ?? "",
      );

      const displayName = String(
        formData.get("displayName") ?? "",
      );

      const email = String(
        formData.get("email") ?? "",
      );

      const password = String(
        formData.get("password") ?? "",
      );

      try {
        const result = await register(
          username,
          displayName,
          email,
          password,
        );

        if (message) {
          message.textContent =
            `Account created for ${result.username}`;
        }

        form.reset();
      } catch (error) {
        if (message) {
          message.textContent =
            error instanceof Error
              ? error.message
              : "Registration failed";
        }
      }
    });
  }

  document.addEventListener("keydown", handleEscape);

  function handleEscape(event: KeyboardEvent): void {
    if (event.key === "Escape" && activePanel !== null) {
      closePanel();
    }
  }

  render();

  /*
   * The old Home page loaded the current user after rendering.
   * The new page does not need that request because authentication
   * state is already determined by wizardToken.
   */
  void getCurrentUser;
}
