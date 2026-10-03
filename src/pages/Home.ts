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
        "Built by players, for players.",
        `
          <p class="home-modal-copy">
            We are two software development students, game lovers, and longtime
            fans of Wizard. We created this platform because we wanted a better
            way to play the game online with friends.
          </p>

          <p class="home-modal-copy">
            Wizard is a brilliant game of prediction, risk, and surprises, but
            the online experience we found did not live up to the tabletop one.
            So we decided to build the game we wanted to play: a welcoming
            place to gather, compete, and enjoy Wizard together.
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
          <div class="home-rules-content">
            <section class="home-rules-section">
              <h3>Materials</h3>
              <p>
                A 60-card deck with four colours numbered 1 through 13,
                four Wizards (Z), and four Jesters (N). Jesters are lowest
                in value, followed by the numbered cards, with Wizards highest.
                A score pad is also included.
              </p>
            </section>

            <section class="home-rules-section">
              <h3>Object of the Game</h3>
              <p>
                Predict the number of tricks you will take in each round.
                Correct predictions score points, and the player with the most
                points wins.
              </p>
            </section>

            <section class="home-rules-section">
              <h3>The Deal</h3>
              <p>
                Deal one card to each player to determine the dealer. The high
                card deals. On the first deal each player receives one card;
                two cards are dealt on the second deal, three on the third,
                and so on. The deal passes left after each round, and the new
                dealer shuffles all 60 cards.
              </p>
              <p>
                Turn up the next card to determine trump. A Jester means there
                is no trump. If it is a Wizard, the dealer chooses a suit. On
                the last round, all cards are dealt and there is no trump.
              </p>
            </section>

            <section class="home-rules-section">
              <h3>Bidding</h3>
              <p>
                Beginning to the left of the dealer, each player states the
                number of tricks they will take and the scorer records it. The
                total bid may be greater than, less than, or equal to the
                number of tricks available.
              </p>
            </section>

            <section class="home-rules-section">
              <h3>The Play</h3>
              <p>
                Play begins to the left of the dealer and continues clockwise.
                Any card may be led, but players must follow suit when possible.
                If unable to follow suit, a player may play any card, including
                trump. Wizards and Jesters may be played at any time.
              </p>
              <ol>
                <li>The first Wizard played wins the trick.</li>
                <li>If no Wizard is played, the highest trump wins.</li>
                <li>If no trump is played, the highest card of the led suit wins.</li>
              </ol>
              <p>The winner of each trick leads the next one.</p>
            </section>

            <section class="home-rules-section">
              <h3>Leading Wizards or Jesters</h3>
              <p>
                A Wizard led first wins the trick, and players may play any
                card. A Jester is a null card; the suit is determined by the
                next card played, and Jesters always lose. If only Jesters are
                played, the first Jester wins.
              </p>
            </section>

            <section class="home-rules-section">
              <h3>Scoring</h3>
              <p>
                A correct prediction scores 20 points plus 10 points for each
                trick taken. An incorrect prediction loses 10 points for each
                trick over or under the prediction.
              </p>
              <div class="home-scoring-example">
                <strong>Example</strong>
                <p>
                  Calling 0 and taking 0 scores 20. Calling 1 and taking 1
                  scores 30. Calling 2 and taking 1 loses 10.
                </p>
              </div>
            </section>

            <section class="home-rules-section">
              <h3>Length of Game</h3>
              <p>
                Play continues until all 60 cards are dealt. Three players play
                20 rounds, four play 15, five play 12, and six play 10 rounds.
              </p>
            </section>

            <section class="home-rules-section">
              <h3>Keeping Track of Tricks</h3>
              <p>
                Before play begins, announce each player&apos;s bid. Keep tricks
                won visible to everyone. Coins or poker chips can mark each
                bid so players can see how many tricks they still need.
              </p>
            </section>

            <section class="home-rules-section">
              <h3>Bidding Variations</h3>
              <ol>
                <li><strong>Hidden Bid:</strong> Reveal all bids simultaneously.</li>
                <li><strong>Delayed Reveal:</strong> Record bids and reveal them after the hand.</li>
                <li>
                  <strong>Optional Rule:</strong> If the last bidder has the highest
                  score, they cannot make the bids even. This rule does not apply
                  when there is a tie for the lead.
                </li>
              </ol>
            </section>
          </div>
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
        "Reach the team",
        `
          <p class="home-modal-copy">
            Questions, feedback, suggestions, or copyright concerns?
          </p>

          <p class="home-modal-copy">
            Email us at
            <a
              class="home-modal-link"
              href="mailto:wizard.platform@gmail.com"
            >
              wizard.platform@gmail.com
            </a>
          </p>
        `,
      );
      attachCloseEvent();
      return;
    }

    if (activePanel === "legal") {
      panelContainer.innerHTML = renderInfoPanel(
        "Copyright & Legal",
        "Third-party content notice",
        `
          <p class="home-modal-copy">
            Wizard Platform is a public, non-commercial educational project
            created by Carlos Denegri and Rufus Lane.
          </p>

          <p class="home-modal-copy">
            Wizard is an existing tabletop card game created by Ken Fisher,
            with art by Franz Vohwinkel and published by AMIGO. Wizard existed
            before this website and builds on familiar playing-card traditions.
            Wizard Platform is an independent student-made digital project and
            is not affiliated with or endorsed by AMIGO or the original game
            creators.
          </p>

          <p class="home-modal-copy">
            The card images and related game artwork are from or based on the
            original Wizard game. We do not claim ownership of those images,
            names, or related game materials.
          </p>

          <p class="home-modal-copy">
            The soundtrack includes original music from Chessmaster II,
            including music associated with the PlayStation release and Joseph
            Kolkovich. Copyright and publishing rights belong to the relevant
            original developers and publishers, including Mindscape and
            Starsphere Interactive. We do not claim ownership of that music or
            its recording.
          </p>

          <p class="home-modal-copy">
            This project is made for educational and demonstration purposes.
            Rights holders who have questions about the materials used here
            should email
            <a
              class="home-modal-link"
              href="mailto:wizard.platform@gmail.com"
            >
              wizard.platform@gmail.com
            </a>
            so the relevant content can be reviewed or removed.
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
