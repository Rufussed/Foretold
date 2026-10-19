import {
  createGuestGame,
  getCurrentUser,
  login,
  logout,
  register,
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
  | "about"
  | "rules"
  | "news"
  | "board"
  | "contact"
  | "legal"
  | null;

const OLDEST_BIRTH_YEAR = 1900;

// Day / month / year dropdowns instead of a calendar: on phones they open the
// native scroll wheel, so picking a year decades back is a single flick.
function birthDateSelectsHtml(): string {
  const monthName = new Intl.DateTimeFormat(getLanguage(), { month: "long" });
  const option = (value: number, label: string | number) =>
    `<option value="${value}">${label}</option>`;

  const days = Array.from({ length: 31 }, (_, i) => option(i + 1, i + 1));
  const months = Array.from({ length: 12 }, (_, i) =>
    option(i + 1, monthName.format(new Date(2000, i, 1))),
  );
  const currentYear = new Date().getFullYear();
  const years = Array.from(
    { length: currentYear - OLDEST_BIRTH_YEAR + 1 },
    (_, i) => option(currentYear - i, currentYear - i),
  );

  return `
    <span class="home-dob">
      <select name="birthDay" aria-label="${t("signup.day")}" autocomplete="bday-day" required>
        <option value="">${t("signup.day")}</option>${days.join("")}
      </select>
      <select name="birthMonth" aria-label="${t("signup.month")}" autocomplete="bday-month" required>
        <option value="">${t("signup.month")}</option>${months.join("")}
      </select>
      <select name="birthYear" aria-label="${t("signup.year")}" autocomplete="bday-year" required>
        <option value="">${t("signup.year")}</option>${years.join("")}
      </select>
    </span>
  `;
}

// "YYYY-MM-DD", or "" when the combination is not a real past date (31 Feb).
function birthDateFromForm(formData: FormData): string {
  const day = Number(formData.get("birthDay"));
  const month = Number(formData.get("birthMonth"));
  const year = Number(formData.get("birthYear"));
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date > new Date()
  ) {
    return "";
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

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
            <span class="home-title">Foretold</span>
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
        t("about.title"),
        t("about.kicker"),
        aboutHtml(),
      );
      attachCloseEvent();
      return;
    }

    if (activePanel === "rules") {
      panelContainer.innerHTML = renderInfoPanel(
        t("rules.title"),
        t("rules.kicker"),
        rulesHtml(),
      );

      attachCloseEvent();
      return;
    }
    if (activePanel === "news") {
      panelContainer.innerHTML = renderInfoPanel(
        t("news.title"),
        t("news.kicker"),
        `
          <p class="home-modal-copy">
            ${t("news.empty")}
          </p>
        `,
      );
      attachCloseEvent();
      return;
    }

    if (activePanel === "board") {
      panelContainer.innerHTML = renderInfoPanel(
        t("board.title"),
        t("board.kicker"),
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
        t("contact.kicker"),
        `
          <p class="home-modal-copy">
            ${t("contact.question")}
          </p>

          <p class="home-modal-copy">
            ${t("contact.emailUs")}
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
        t("legal.title"),
        t("legal.kicker"),
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

          <p class="home-modal-kicker">${t("login.kicker")}</p>

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

          <p class="home-modal-kicker">${t("signup.kicker")}</p>

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
              ${t("signup.lastName")}
              <input
                name="lastName"
                type="text"
                autocomplete="family-name"
                maxlength="50"
                required
              />
              <small class="home-auth-hint">${t("signup.privateHint")}</small>
            </label>

            <label>
              ${t("signup.birthDate")}
              ${birthDateSelectsHtml()}
              <small class="home-auth-hint">${t("signup.privateHint")}</small>
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
            aria-label="${t("common.close")}"
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

      const lastName = String(
        formData.get("lastName") ?? "",
      );

      const birthDate = birthDateFromForm(formData);

      const email = String(
        formData.get("email") ?? "",
      );

      const password = String(
        formData.get("password") ?? "",
      );

      // There is no password reset, so a typo here would lock the player out.
      if (password !== String(formData.get("confirmPassword") ?? "")) {
        if (message) {
          message.textContent = t("signup.passwordMismatch");
        }
        return;
      }

      if (!birthDate) {
        if (message) {
          message.textContent = t("error.invalidBirthDate");
        }
        return;
      }

      try {
        await register(
          username,
          lastName,
          birthDate,
          email,
          password,
        );

        closePanel();
        showToast(t("signup.done"));

        window.location.hash = "#/home";
        window.dispatchEvent(
          new HashChangeEvent("hashchange"),
        );
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
