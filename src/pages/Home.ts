import {
  createGuestGame,
  getCurrentUser,
  login,
  logout,
  register,
} from "../services/auth";

type Panel = "login" | "signup" | "about" | "rules" | "news" | "contact" | "legal" | null;

export async function renderHomePage(container: HTMLElement): Promise<void> {
  // The page must come up whatever the server is doing: a cold or unreachable
  // backend (a phone on a weak connection) used to leave only the 3D backdrop
  // showing, because the page waited on this lookup and never drew.
  const lookup = localStorage.getItem("wizardToken")
    ? await Promise.race([
        getCurrentUser().catch(() => null),
        new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 5000)),
      ])
    : null;
  const currentUser = lookup;
  // A rejected session has already removed its token; a lookup that merely
  // failed or timed out keeps it, so the account buttons still show.
  const token = localStorage.getItem("wizardToken");
  const isLoggedIn = Boolean(token);

  // A guest finishing a game sends them here to sign up (see
  // visualizer/guest-signup-prompt.ts).
  let activePanel: Panel = null;
  try {
    if (sessionStorage.getItem("wizardOpenSignup") === "1") {
      sessionStorage.removeItem("wizardOpenSignup");
      if (!isLoggedIn) activePanel = "signup";
    }
  } catch {
    // No storage: the home page opens as usual.
  }

  // Signed-in players are greeted by name; a session whose lookup failed
  // still counts as signed in, so it gets a plain welcome rather than
  // "Stranger".
  function welcomeMessage(): string {
    if (!isLoggedIn) {
      return "Welcome, Stranger";
    }

    const name = currentUser?.displayName || currentUser?.username;

    return name
      ? `Welcome, ${name.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)}`
      : "Welcome";
  }

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
              src="/wizardLogo.webp"
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
          <p class="home-welcome">${welcomeMessage()}</p>

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
        "Learn the rules of Wizard.",
        `
          <div class="home-rules-content">

            <section class="home-rules-section">
              <h3>Materials</h3>
              <p>
                Wizard is played with a 60-card deck containing four coloured
                suits, numbered cards, Wizards, and Jesters.
                Wizards are the highest-ranking special cards, while Jesters
                are the lowest. The game also uses a score pad.
              </p>
            </section>

            <section class="home-rules-section">
              <h3>Object of the Game</h3>
              <p>
                Predict how many tricks you will win in each round.
                Earn points by predicting correctly and avoid penalties
                by estimating your tricks accurately. The player with
                the highest total score at the end of the game wins.
              </p>
            </section>

            <section class="home-rules-section">
              <h3>Rounds and Dealing</h3>
              <p>
                Each round determines how many cards each player receives.
                In Round 1, each player receives one card. In Round 2,
                each receives two cards, and so on.
              </p>
              <p>
                The maximum number of rounds depends on the number of players:
              </p>
              <ul>
                <li>3 players: 20 rounds</li>
                <li>4 players: 15 rounds</li>
                <li>5 players: 12 rounds</li>
                <li>6 players: 10 rounds</li>
              </ul>
              <p>
                The dealer rotates after each round. After the cards are
                dealt, the next card is revealed to determine the trump suit,
                except in the final round, when there is no trump suit.
              </p>
            </section>

            <section class="home-rules-section">
              <h3>Predictions</h3>
              <p>
                Before playing, each player predicts how many tricks they
                expect to win during the round. Your prediction can range
                from zero to the number of cards in your hand.
              </p>
              <p>
                <strong>Special rule:</strong> The last player to predict
                cannot choose a number equal to the number of cards in their
                hand. For example, if they have three cards, they cannot
                predict three tricks.
              </p>
              <p>
                This restriction prevents the total predictions from
                equalling the number of tricks available in the round.
              </p>
            </section>

            <section class="home-rules-section">
              <h3>Tricks and Player Rotation</h3>
              <p>
                A trick consists of every player playing one card. The
                winner takes the trick, and the number of tricks you win
                during a round is your trick count.
              </p>
              <p>
                The starting player rotates each round. The designated
                starting player leads the first trick, and the winner
                of each trick leads the next one.
              </p>
              <p>
                For example, in Round 3, each player receives three cards,
                so three tricks are played.
              </p>
            </section>

            <section class="home-rules-section">
              <h3>Playing Cards and Winning Tricks</h3>
              <p>
                The first card played determines the lead suit. Players
                must follow that suit whenever possible. If you have no
                cards of the lead suit, you may play any card, including
                a trump card, Wizard, or Jester.
              </p>
              <ol>
                <li>The highest-numbered card of the lead suit normally wins.</li>
                <li>A trump card beats cards of the lead suit.</li>
                <li>If multiple trump cards are played, the highest-numbered
                  trump card wins, unless a Wizard determines the winner.</li>
                <li>Wizards and Jesters follow their special rules.</li>
              </ol>
            </section>

            <section class="home-rules-section">
              <h3>Trump Suit</h3>
              <p>
                In every round except the final round, a card is revealed
                after dealing to determine the trump suit. Trump is stronger
                than the other coloured suits.
              </p>
              <p>
                You may play a trump card when the lead suit is trump or
                when you cannot follow the lead suit. If several trump
                cards are played, the highest-numbered trump card wins,
                unless a Wizard determines the winner.
              </p>
              <p>
                <strong>If the revealed card is a Wizard:</strong>
                The player leading the first trick chooses the trump suit.
                A coloured rim around the Wizard displays the chosen suit
                throughout the round.
              </p>
              <p>
                <strong>If the revealed card is a Jester:</strong>
                There is no trump suit for that round. The rim remains white.
              </p>
              <p>
                <strong>Final round:</strong> No trump card is revealed,
                and there is no trump suit.
              </p>
              <p>
                <strong>Blind first round (rule variation):</strong> In the
                first round each player holds their one card facing outwards,
                so you can see everyone's card except your own. Predict, then
                play your card without ever seeing it.
              </p>
            </section>

            <section class="home-rules-section">
              <h3>Wizards and Jesters</h3>

              <p>
                <strong>Wizards:</strong> Wizards can be played at any time,
                regardless of the lead suit. Normally, the first Wizard
                played wins the trick, even if other Wizards are played later.
              </p>
              <p>
                <strong>Rule variation:</strong> The host can choose
                <em>Last Wizard wins</em> in the game's Rule Variations, so
                the last Wizard played takes the trick instead of the first.
              </p>
              <p>
                <strong>Strategy tip:</strong> When the first Wizard wins,
                playing a Wizard after another player has already played one
                gets rid of your Wizard without winning the trick.
              </p>
              <p>
                <strong>Jesters:</strong> Jesters are the lowest-ranking
                cards and normally lose tricks. They can be played at any
                time and are useful when you want to avoid winning a trick.
                If only Jesters are played, the first Jester wins.
              </p>
            </section>

            <section class="home-rules-section">
              <h3>Scoring</h3>
              <p>
                Your score depends on how accurately you predict your tricks.
              </p>
              <ul>
                <li>Predict zero and win zero: +20 points.</li>
                <li>Predict one or more tricks correctly: +10 points
                  per predicted trick.</li>
                <li>Miss your prediction: −10 points for each trick
                  of difference.</li>
              </ul>

              <div class="home-scoring-example">
                <strong>Examples</strong>
                <p>
                  Predict 0 and win 0: +20 points.<br>
                  Predict 2 and win 2: +20 points.<br>
                  Predict 3 and win 3: +30 points.<br>
                  Predict 2 and win 1: −10 points.<br>
                  Predict 2 and win 0: −20 points.
                </p>
              </div>
            </section>

            <section class="home-rules-section">
              <h3>Winning the Game</h3>
              <p>
                After all rounds are completed, the player with the
                highest total score wins.
              </p>
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

    // A drag that starts in the box (selecting text in a field) and ends on
    // the backdrop still fires a click on the backdrop, so only close when
    // the press began there too.
    let pressedOnBackdrop = false;
    backdrop?.addEventListener("pointerdown", (event) => {
      pressedOnBackdrop = event.target === backdrop;
    });
    backdrop?.addEventListener("click", (event) => {
      if (event.target === backdrop && pressedOnBackdrop) {
        closePanel();
      }
      pressedOnBackdrop = false;
    });
  }

  // A short confirmation that outlives the panel it came from.
  function showToast(text: string): void {
    const toast = document.createElement("div");
    toast.className = "home-toast";
    toast.setAttribute("role", "status");
    toast.textContent = text;
    document.body.append(toast);
    window.setTimeout(() => toast.remove(), 2800);
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
        await register(
          username,
          displayName,
          email,
          password,
        );

        closePanel();
        showToast("You are signed up");

        window.location.hash = "#/home";
        window.dispatchEvent(
          new HashChangeEvent("hashchange"),
        );
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
