import { watchStartedGame } from "../services/started-game";
import {
  EmailNotVerifiedError,
  createGuestGame,
  getCurrentUser,
  login,
  logout,
  register,
  requestAccountMail,
} from "../services/auth";
import {
  POST_MAX_LENGTH,
  createPost,
  deletePost,
  listPosts,
  type BoardPost,
} from "../services/posts";
import { getLanguage, setLanguage, t } from "../i18n";
import { aboutHtml, legalHtml, rulesHtml } from "../i18n/long-texts";
import { escapeHtml } from "../utils/escape-html";

type Panel =
  | "login"
  | "signup"
  | "forgot"
  | "checkMail"
  | "about"
  | "rules"
  | "news"
  | "board"
  | "contact"
  | "legal"
  | null;

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
  // The address the last sign-up's link went to (the "checkMail" window).
  let signedUpEmail = "";
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
      return t("home.welcomeStranger");
    }

    const name = currentUser?.displayName || currentUser?.username;

    return name
      ? t("home.welcomeName", { name: escapeHtml(name) })
      : t("home.welcome");
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
              src="/logo-foretold.webp"
              alt="Foretold"
            />
          </a>

          <button
            type="button"
            class="home-menu-toggle"
            id="home-menu-toggle"
            aria-label="${t("nav.menu")}"
            aria-expanded="false"
            aria-controls="home-top-nav"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>

          <nav class="home-top-nav" id="home-top-nav" aria-label="${t("nav.main")}">
            <button type="button" data-panel="about">
              ${t("nav.about")}
            </button>

            <span></span>

            <button type="button" data-panel="rules">
              ${t("nav.rules")}
            </button>

            <span></span>

            <button type="button" data-panel="board">
              ${t("nav.board")}
            </button>

            <span></span>

            <button type="button" data-panel="news">
              ${t("nav.news")}
            </button>

          </nav>

          <div class="home-account-actions">
            <button
              type="button"
              class="home-account-button home-language-button"
              id="home-language-button"
              aria-label="${t("language.switchLabel")}"
            >
              ${t("language.switchTo")}
            </button>

            ${
              isLoggedIn
                ? `
                  <a
                    class="home-account-button"
                    id="home-profile-link"
                    href="#/profile"
                  >
                    ${escapeHtml(currentUser?.displayName || currentUser?.username || "")}
                  </a>

                  <button
                    type="button"
                    class="home-account-button home-signup-button"
                    id="home-logout-button"
                  >
                    ${t("account.logout")}
                  </button>
                `
                : `
                  <button
                    type="button"
                    class="home-account-button"
                    data-panel="login"
                  >
                    ${t("account.login")}
                  </button>

                  <button
                    type="button"
                    class="home-account-button home-signup-button"
                    data-panel="signup"
                  >
                    ${t("account.signup")}
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
            <span>${t("home.play")}</span>
          </button>
        </section>

        <footer class="home-footer">
          <p>Foretold</p>
          <button type="button" data-panel="legal">
            ${t("home.legal")}
          </button>

          <button type="button" data-panel="contact">
            ${t("home.contact")}
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

    // A game the player is seated in has started without them: their name
    // turns gold and glows, and Profile has the button to the table.
    const profileLink =
      container.querySelector<HTMLAnchorElement>("#home-profile-link");

    if (profileLink && currentUser) {
      watchStartedGame(profileLink, currentUser.username, (game) => {
        profileLink.classList.toggle("home-account-alert", game !== null);
        profileLink.title = game
          ? t("nav.tipGameStarted", { room: game.name })
          : "";
      });
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
      focusFirstInput(panelContainer);
      return;
    }

    if (activePanel === "signup") {
      panelContainer.innerHTML = renderSignupPanel();
      attachSignupEvents();
      focusFirstInput(panelContainer);
      return;
    }

    if (activePanel === "forgot") {
      panelContainer.innerHTML = renderForgotPanel();
      attachForgotEvents();
      focusFirstInput(panelContainer);
      return;
    }

    if (activePanel === "checkMail") {
      panelContainer.innerHTML = renderCheckMailPanel();
      attachCloseEvent();
      panelContainer
        .querySelector<HTMLButtonElement>("#home-check-mail-ok")
        ?.addEventListener("click", closePanel);
      panelContainer.querySelector<HTMLButtonElement>("#home-check-mail-ok")?.focus();
      return;
    }

    if (activePanel === "about") {
      panelContainer.innerHTML = renderInfoPanel(
        t("about.title"),
        aboutHtml(),
      );
      attachCloseEvent();
      return;
    }

    if (activePanel === "rules") {
      panelContainer.innerHTML = renderInfoPanel(
        t("rules.title"),
        // The same rules also stand as a page of their own (how-to-play/,
        // de/spielanleitung/), to share or print; this link also shows
        // search engines the way there.
        `${rulesHtml()}
          <p class="home-modal-copy home-rules-page-link">
            <a
              class="home-modal-link"
              href="${getLanguage() === "de" ? "/de/spielanleitung/" : "/how-to-play/"}"
              target="_blank"
              rel="noopener"
            >${t("rules.openAsPage")}</a>
          </p>`,
      );

      attachCloseEvent();
      return;
    }
    if (activePanel === "news") {
      panelContainer.innerHTML = renderInfoPanel(
        t("news.title"),
        // Newest first. A new entry: its date, title and text in en.ts and
        // de.ts, and its key at the top of this list.
        `
          <div class="home-story home-news">
            ${(["launch"] as const)
              .map(
                (entry) => `
                  <article class="home-news-entry">
                    <p class="home-news-date">${t(`news.${entry}.date`)}</p>
                    <h3 class="home-news-heading">${t(`news.${entry}.title`)}</h3>
                    <p class="home-modal-copy">${t(`news.${entry}.text`)}</p>
                  </article>
                `,
              )
              .join("")}
          </div>
        `,
      );
      attachCloseEvent();
      return;
    }

    if (activePanel === "board") {
      panelContainer.innerHTML = renderInfoPanel(
        t("board.title"),
        `
          <div class="home-board">
            <ol id="home-board-list" class="home-board-list"></ol>
            <p id="home-board-status" class="home-board-status">${t("board.loading")}</p>
            <button
              type="button"
              id="home-board-more"
              class="home-switch-auth"
              hidden
            >
              ${t("board.older")}
            </button>

            <div class="home-board-compose">
            ${
              isLoggedIn
                ? `
                  <button
                    type="button"
                    id="home-board-open"
                    class="home-board-open"
                    aria-expanded="false"
                    aria-controls="home-board-form"
                  >
                    ${t("board.label")}
                  </button>
                  <form id="home-board-form" class="home-board-form" hidden>
                    <textarea
                      id="home-board-text"
                      name="text"
                      rows="3"
                      maxlength="${POST_MAX_LENGTH}"
                      placeholder="${t("board.placeholder")}"
                      aria-label="${t("board.label")}"
                      required
                    ></textarea>
                    <div class="home-board-form-row">
                      <span id="home-board-count" class="home-board-count">
                        0 / ${POST_MAX_LENGTH}
                      </span>
                      <span class="home-board-actions">
                        <button type="button" id="home-board-cancel" class="home-switch-auth">
                          ${t("board.cancel")}
                        </button>
                        <button type="submit" class="home-modal-primary">
                          ${t("board.post")}
                        </button>
                      </span>
                    </div>
                    <p
                      id="home-board-message"
                      class="home-auth-message"
                      role="status"
                    ></p>
                  </form>
                `
                : `
                  <p class="home-modal-copy">
                    ${t("board.readOnly", {
                      login: `<button
                        type="button"
                        class="home-board-inline-link"
                        id="home-board-login"
                      >${t("board.readOnlyLogin")}</button>`,
                    })}
                  </p>
                `
            }
            </div>
          </div>
        `,
      );
      attachBoardEvents();
      return;
    }

    if (activePanel === "contact") {
      panelContainer.innerHTML = renderInfoPanel(
        t("contact.title"),
        `
          <p class="home-modal-copy">
            ${t("contact.question")}
          </p>

          <p class="home-modal-copy">
            ${t("contact.emailUs")}
            <a
              class="home-modal-link"
              href="mailto:developer@foretold.live"
            >
              developer@foretold.live
            </a>
          </p>
        `,
      );
      attachCloseEvent();
      return;
    }

    if (activePanel === "legal") {
      panelContainer.innerHTML = renderInfoPanel(
        t("legal.title"),
        legalHtml(),
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
            aria-label="${t("common.close")}"
          >
            <span></span>
            <span></span>
          </button>

          <h2 id="home-login-title">${t("login.title")}</h2>

          <form id="home-login-form" class="home-auth-form">
            <label>
              ${t("login.username")}
              <input
                name="username"
                type="text"
                autocomplete="username"
                required
              />
            </label>

            <label>
              ${t("login.password")}
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
              ${t("login.submit")}
            </button>
          </form>

          <p
            id="home-login-message"
            class="home-auth-message"
          ></p>

          <button
            type="button"
            class="home-switch-auth"
            id="home-resend-verification"
            hidden
          >
            ${t("login.resend")}
          </button>

          <button
            type="button"
            class="home-switch-auth"
            id="home-switch-to-forgot"
          >
            ${t("login.forgot")}
          </button>

          <button
            type="button"
            class="home-switch-auth"
            id="home-switch-to-signup"
          >
            ${t("login.toSignup")}
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
            aria-label="${t("common.close")}"
          >
            <span></span>
            <span></span>
          </button>

          <h2 id="home-signup-title">${t("signup.title")}</h2>

          <form id="home-signup-form" class="home-auth-form">
            <label>
              ${t("signup.username")}
              <input
                name="username"
                type="text"
                autocomplete="username"
                minlength="3"
                maxlength="20"
                pattern="[A-Za-z0-9_\-]+"
                title="${t("signup.usernameHint")}"
                required
              />
            </label>

            <label>
              ${t("signup.email")}
              <input
                name="email"
                type="email"
                autocomplete="email"
                required
              />
            </label>

            <label>
              ${t("signup.password")}
              <input
                name="password"
                type="password"
                autocomplete="new-password"
                minlength="8"
                required
              />
            </label>

            <label>
              ${t("signup.confirmPassword")}
              <input
                name="confirmPassword"
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
              ${t("signup.submit")}
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
            ${t("signup.toLogin")}
          </button>
        </section>
      </div>
    `;
  }

  function renderForgotPanel(): string {
    return `
      <div class="home-modal-backdrop">
        <section
          class="home-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="home-forgot-title"
        >
          <button
            type="button"
            class="home-close-button"
            id="home-close-button"
            aria-label="${t("common.close")}"
          >
            <span></span>
            <span></span>
          </button>

          <h2 id="home-forgot-title">${t("forgot.title")}</h2>

          <form id="home-forgot-form" class="home-auth-form">
            <p class="home-auth-message">${t("forgot.intro")}</p>

            <label>
              ${t("login.username")}
              <input
                name="login"
                type="text"
                autocomplete="username"
                required
              />
            </label>

            <button
              type="submit"
              class="home-modal-primary"
            >
              ${t("forgot.submit")}
            </button>
          </form>

          <p
            id="home-forgot-message"
            class="home-auth-message"
          ></p>

          <button
            type="button"
            class="home-switch-auth"
            id="home-switch-to-login"
          >
            ${t("forgot.toLogin")}
          </button>
        </section>
      </div>
    `;
  }

  // After signing up: where the link went. Its own window, so it is not
  // missed under the form.
  function renderCheckMailPanel(): string {
    return `
      <div class="home-modal-backdrop">
        <section
          class="home-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="home-check-mail-title"
        >
          <button
            type="button"
            class="home-close-button"
            id="home-close-button"
            aria-label="${t("common.close")}"
          >
            <span></span>
            <span></span>
          </button>

          <h2 id="home-check-mail-title">${t("signup.checkTitle")}</h2>

          <p class="home-modal-copy">
            ${t("signup.checkSent", { email: `<strong>${escapeHtml(signedUpEmail)}</strong>` })}
          </p>
          <p class="home-modal-copy">${t("signup.checkOpen")}</p>
          <p class="home-modal-copy">${t("signup.checkSpam")}</p>

          <button
            type="button"
            class="home-modal-primary home-check-mail-ok"
            id="home-check-mail-ok"
          >
            ${t("signup.checkOk")}
          </button>
        </section>
      </div>
    `;
  }

  function renderInfoPanel(
    title: string,
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
            aria-label="${t("common.close")}"
          >
            <span></span>
            <span></span>
          </button>

          <h2 id="home-info-title">
            ${title}
          </h2>

          ${content}
        </section>
      </div>
    `;
  }

  function attachHomeEvents(): void {
    // On a phone the four entries live in a menu behind a button; picking one
    // (its own handler below opens the panel), or tapping elsewhere, closes it.
    const topbar = container.querySelector<HTMLElement>(".home-topbar");
    const menuToggle = container.querySelector<HTMLButtonElement>("#home-menu-toggle");
    const setMenu = (open: boolean) => {
      topbar?.classList.toggle("is-menu-open", open);
      menuToggle?.setAttribute("aria-expanded", String(open));
    };
    menuToggle?.addEventListener("click", (event) => {
      event.stopPropagation();
      setMenu(!topbar?.classList.contains("is-menu-open"));
    });
    container
      .querySelectorAll<HTMLButtonElement>(".home-top-nav [data-panel]")
      .forEach((button) => button.addEventListener("click", () => setMenu(false)));
    container.addEventListener("click", (event) => {
      if (!(event.target as HTMLElement).closest(".home-top-nav")) setMenu(false);
    });

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

    document
      .querySelector<HTMLButtonElement>("#home-language-button")
      ?.addEventListener("click", () => {
        setLanguage(getLanguage() === "de" ? "en" : "de");
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
            : t("home.guestGameFailed"),
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

  // Server times are UTC without a zone ("2026-10-16 11:00:00").
  function formatPostTime(createdAt: string): string {
    const date = new Date(`${createdAt.replace(" ", "T")}Z`);

    return Number.isNaN(date.getTime())
      ? ""
      : date.toLocaleString(getLanguage(), { dateStyle: "medium", timeStyle: "short" });
  }

  // Built from DOM nodes with textContent, so whatever a player wrote is
  // shown as text and never read as HTML.
  function renderBoardPost(post: BoardPost): HTMLLIElement {
    const item = document.createElement("li");
    item.className = "home-board-post";

    const meta = document.createElement("div");
    meta.className = "home-board-meta";

    const name = document.createElement("strong");
    name.textContent = post.displayName || post.username;

    const detail = document.createElement("span");
    detail.textContent = `@${post.username} · ${formatPostTime(post.createdAt)}`;

    meta.append(name, detail);

    if (post.canDelete) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "home-board-delete";
      remove.textContent = t("board.delete");
      remove.addEventListener("click", async () => {
        if (!window.confirm(t("board.confirmDelete"))) return;

        remove.disabled = true;

        try {
          await deletePost(post.id);
          item.remove();
        } catch (error) {
          remove.disabled = false;
          alert(error instanceof Error ? error.message : t("board.deleteFailed"));
        }
      });
      meta.append(remove);
    }

    const text = document.createElement("p");
    text.className = "home-board-text";
    text.textContent = post.text;

    item.append(meta, text);
    return item;
  }

  function attachBoardEvents(): void {
    attachCloseEvent();

    const list = document.querySelector<HTMLOListElement>("#home-board-list");
    const status = document.querySelector<HTMLParagraphElement>("#home-board-status");
    const moreButton = document.querySelector<HTMLButtonElement>("#home-board-more");

    if (!list || !status || !moreButton) return;

    let oldestId: number | undefined;

    async function loadPage(): Promise<void> {
      moreButton!.disabled = true;

      try {
        const page = await listPosts(oldestId);

        // The panel may have been closed while the page was on its way.
        if (!list!.isConnected) return;

        list!.append(...page.posts.map(renderBoardPost));
        oldestId = page.posts.at(-1)?.id ?? oldestId;
        moreButton!.hidden = !page.hasMore;
        status!.textContent = list!.children.length ? "" : t("board.empty");
      } catch (error) {
        status!.textContent =
          error instanceof Error ? error.message : t("board.loadFailed");
      } finally {
        moreButton!.disabled = false;
      }
    }

    moreButton.addEventListener("click", () => void loadPage());
    void loadPage();

    document
      .querySelector<HTMLButtonElement>("#home-board-login")
      ?.addEventListener("click", () => {
        activePanel = "login";
        renderPanel();
      });

    const form = document.querySelector<HTMLFormElement>("#home-board-form");
    const textArea = document.querySelector<HTMLTextAreaElement>("#home-board-text");
    const count = document.querySelector<HTMLSpanElement>("#home-board-count");
    const message = document.querySelector<HTMLParagraphElement>("#home-board-message");

    const openButton = document.querySelector<HTMLButtonElement>("#home-board-open");

    if (!form || !textArea || !openButton) return;

    // The composer stays folded away so the posts are what the panel shows.
    const setComposerOpen = (open: boolean) => {
      form.hidden = !open;
      openButton.hidden = open;
      openButton.setAttribute("aria-expanded", String(open));
      if (open) textArea.focus();
    };

    openButton.addEventListener("click", () => setComposerOpen(true));
    document
      .querySelector<HTMLButtonElement>("#home-board-cancel")
      ?.addEventListener("click", () => {
        if (message) message.textContent = "";
        setComposerOpen(false);
      });

    textArea.addEventListener("input", () => {
      if (count) count.textContent = `${textArea.value.length} / ${POST_MAX_LENGTH}`;
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const submit = form.querySelector<HTMLButtonElement>("button[type=submit]");
      if (submit) submit.disabled = true;
      if (message) message.textContent = "";

      try {
        const post = await createPost(textArea.value);

        list.prepend(renderBoardPost(post));
        status.textContent = "";
        textArea.value = "";
        if (count) count.textContent = `0 / ${POST_MAX_LENGTH}`;
        setComposerOpen(false);
        list.scrollTop = 0;
      } catch (error) {
        if (message) {
          message.textContent = error instanceof Error ? error.message : t("board.postFailed");
        }
      } finally {
        if (submit) submit.disabled = false;
      }
    });
  }

  function attachForgotEvents(): void {
    attachCloseEvent();

    document
      .querySelector<HTMLButtonElement>("#home-switch-to-login")
      ?.addEventListener("click", () => {
        activePanel = "login";
        renderPanel();
      });

    const form =
      document.querySelector<HTMLFormElement>("#home-forgot-form");
    const message =
      document.querySelector<HTMLParagraphElement>("#home-forgot-message");

    form?.addEventListener("submit", async (event) => {
      event.preventDefault();

      const submit = form.querySelector<HTMLButtonElement>("button[type=submit]");
      const loginName = String(new FormData(form).get("login") ?? "");

      if (submit) submit.disabled = true;
      try {
        await requestAccountMail("forgot-password", loginName);
        form.hidden = true;
        if (message) message.textContent = t("forgot.sent");
      } catch (error) {
        if (message) {
          message.textContent =
            error instanceof Error ? error.message : t("account.mailFailed");
        }
      } finally {
        if (submit) submit.disabled = false;
      }
    });
  }

  /** Puts the typing cursor in the panel's first field, so no click is needed. */
  function focusFirstInput(container: HTMLElement): void {
    container.querySelector<HTMLInputElement>("input")?.focus();
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

    document
      .querySelector<HTMLButtonElement>("#home-switch-to-forgot")
      ?.addEventListener("click", () => {
        activePanel = "forgot";
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

    // Shown when the account's email is not confirmed yet.
    const resendButton =
      document.querySelector<HTMLButtonElement>(
        "#home-resend-verification",
      );

    resendButton?.addEventListener("click", async () => {
      const username = String(
        new FormData(form ?? undefined).get("username") ?? "",
      );

      resendButton.disabled = true;
      try {
        await requestAccountMail("resend-verification", username);
        if (message) message.textContent = t("login.resent");
        resendButton.hidden = true;
      } catch (error) {
        if (message) {
          message.textContent =
            error instanceof Error ? error.message : t("account.mailFailed");
        }
      } finally {
        resendButton.disabled = false;
      }
    });

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
        if (resendButton) {
          resendButton.hidden = !(error instanceof EmailNotVerifiedError);
        }
        if (message) {
          message.textContent =
            error instanceof Error
              ? error.message
              : t("login.failed");
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

      const email = String(
        formData.get("email") ?? "",
      );

      const password = String(
        formData.get("password") ?? "",
      );

      // A typo here would send the player to "Forgot password?" at once.
      if (password !== String(formData.get("confirmPassword") ?? "")) {
        if (message) {
          message.textContent = t("signup.passwordMismatch");
        }
        return;
      }

      try {
        const result = await register(
          username,
          email,
          password,
        );

        // Not signed in yet: the account opens by the mailed link
        // (pages/AccountLink.ts). A window says where to look.
        signedUpEmail = result.email;
        activePanel = "checkMail";
        renderPanel();
      } catch (error) {
        if (message) {
          message.textContent =
            error instanceof Error
              ? error.message
              : t("signup.failed");
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
