import {
  getCurrentUser,
  login,
  logout,
  register,
} from "../services/auth";

type Panel = "login" | "signup" | "about" | "rules" | "contact" | "legal" | null;

export function renderHomePage(container: HTMLElement): void {
  const token = localStorage.getItem("wizardToken");
  const isLoggedIn = Boolean(token);

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

          </nav>

          <div class="home-account-actions">
            ${
              isLoggedIn
                ? `
                  <a
                    class="home-account-button"
                    href="#/profile"
                  >
                    Profile
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
            <li>
              <span>06</span>
              Miss it and you lose ten points for every trick out.
            </li>
            <li>
              <span>07</span>
              A Wizard can be played at any time, whatever the lead suit, and
              the first one played wins the trick.
            </li>
            <li>
              <span>08</span>
              A Jester can be played at any time, and always loses.
            </li>
          </ul>
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

    playButton?.addEventListener("click", () => {
      if (localStorage.getItem("wizardToken")) {
        window.location.hash = "#/lobby";
        return;
      }

      activePanel = "login";
      renderPanel();
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

// import {
//   getCurrentUser,
//   login,
//   logout,
//   register,
// } from "../services/auth";


// export function renderHomePage(container: HTMLElement): void {
//   const token = localStorage.getItem("wizardToken");
//   const isLoggedIn = Boolean(token);

//   container.innerHTML = `
//     <div class="page">
//       ${renderNavbarHtml(isLoggedIn)}

//       <main class="panel">
//         <h1>Wizard Platform</h1>
//         <p>Welcome to the Wizard card game platform.</p>

//         ${
//           isLoggedIn
//             ? `
//               <section class="panel">
//                 <h2>Welcome back</h2>
//                 <p id="home-user-status">Loading user...</p>
//                 <a href="#/lobby">Go to Lobby</a>
//                 <button id="home-logout-button" type="button">Log out</button>
//               </section>
//             `
//             : `
//               <section class="panel">
//                 <h2>Login</h2>
//                 <form id="login-form">
//                   <label>
//                     Username
//                     <input name="username" type="text" required />
//                   </label>

//                   <label>
//                     Password
//                     <input name="password" type="password" required />
//                   </label>

//                   <button type="submit">Log in</button>
//                 </form>
//                 <p id="login-message"></p>
//               </section>

//               <section class="panel">
//                 <h2>Create account</h2>
//                 <form id="registration-form">
//                   <label>
//                     Username
//                     <input name="username" type="text" required />
//                   </label>

//                   <label>
//                     Display name
//                     <input name="displayName" type="text" required />
//                   </label>

//                   <label>
//                     Email
//                     <input name="email" type="email" required />
//                   </label>

//                   <label>
//                     Password
//                     <input name="password" type="password" minlength="8" required />
//                   </label>

//                   <button type="submit">Register</button>
//                 </form>
//                 <p id="registration-message"></p>
//               </section>
//             `
//         }
//       </main>
//     </div>
//   `;

//   const loginForm = document.querySelector<HTMLFormElement>("#login-form");
//   const registrationForm =
//     document.querySelector<HTMLFormElement>("#registration-form");
//   const loginMessage =
//     document.querySelector<HTMLParagraphElement>("#login-message");
//   const registrationMessage = document.querySelector<HTMLParagraphElement>(
//     "#registration-message",
//   );
//   const homeUserStatus =
//     document.querySelector<HTMLParagraphElement>("#home-user-status");
//   const homeLogoutButton =
//     document.querySelector<HTMLButtonElement>("#home-logout-button");

//   if (isLoggedIn) {
//     loadLoggedInUser();
//     homeLogoutButton?.addEventListener("click", () => {
//       logout();
//       window.location.hash = "#/home";
//       window.dispatchEvent(new HashChangeEvent("hashchange"));
//     });

//     return;
//   }

//   loginForm?.addEventListener("submit", async (event) => {
//     event.preventDefault();

//     const formData = new FormData(loginForm);
//     const username = String(formData.get("username") ?? "");
//     const password = String(formData.get("password") ?? "");

//     try {
//       await login(username, password);

//       if (loginMessage) {
//         loginMessage.textContent = "Login successful";
//       }

//       window.location.hash = "#/home";
//       window.dispatchEvent(new HashChangeEvent("hashchange"));
//     } catch (error) {
//       if (loginMessage) {
//         loginMessage.textContent =
//           error instanceof Error ? error.message : "Login failed";
//       }
//     }
//   });

//   registrationForm?.addEventListener("submit", async (event) => {
//     event.preventDefault();

//     const formData = new FormData(registrationForm);
//     const username = String(formData.get("username") ?? "");
//     const displayName = String(formData.get("displayName") ?? "");
//     const email = String(formData.get("email") ?? "");
//     const password = String(formData.get("password") ?? "");

//     try {
//       const result = await register(username, displayName, email, password);

//       if (registrationMessage) {
//         registrationMessage.textContent =
//           `Account created for ${result.username}`;
//       }

//       registrationForm.reset();
//     } catch (error) {
//       if (registrationMessage) {
//         registrationMessage.textContent =
//           error instanceof Error
//             ? error.message
//             : "Registration failed";
//       }
//     }
//   });

//   async function loadLoggedInUser(): Promise<void> {
//     try {
//       const user = await getCurrentUser();

//       if (homeUserStatus) {
//         homeUserStatus.textContent =
//           `Logged in as ${user.displayName} (${user.username})`;
//       }
//     } catch {
//       if (homeUserStatus) {
//         homeUserStatus.textContent = "Session expired";
//       }
//     }
//   }
// }

// function renderNavbarHtml(isLoggedIn: boolean): string {
//   const links = [
//     '<a href="#/home">Home</a>',
//     isLoggedIn ? '<a href="#/profile">Profile</a>' : "",
//   ].filter(Boolean);

//   return `
//     <nav class="navbar">
//       ${links.join("")}
//     </nav>
//   `;
// }