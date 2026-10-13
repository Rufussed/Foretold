import { displayName } from "../utils/display-name";

// A guest has just finished a game. Offers them a place in the records, with a
// button that takes them to the sign-up form. Shown once; it keeps out of the
// way of the winner announcement by waiting a few seconds first.

// Read by the home page, which then opens its sign-up panel.
export const OPEN_SIGNUP_KEY = "wizardOpenSignup";

const DELAY_MS = 5000;

export interface GuestSignupPrompt {
  // Call whenever the game finishes; only the first call does anything.
  schedule(): void;
  dispose(): void;
}

export function createGuestSignupPrompt(root: HTMLElement, username: string): GuestSignupPrompt {
  let timer = 0;
  let scheduled = false;
  let box: HTMLElement | null = null;

  const close = () => {
    box?.remove();
    box = null;
  };

  const show = () => {
    box = document.createElement("section");
    box.className = "guest-signup";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", "Sign up");

    const question = document.createElement("p");
    question.className = "guest-signup-question";
    question.textContent = `${displayName(username)}, do you want your Deeds\nrecorded in the Histories?\nBattle real Wizards!`;

    const invitation = document.createElement("p");
    invitation.className = "guest-signup-invitation";
    invitation.textContent = "Add your name to the Lore.";

    const signUp = document.createElement("button");
    signUp.type = "button";
    signUp.className = "guest-signup-button";
    signUp.textContent = "Sign Up";
    signUp.addEventListener("click", () => {
      try {
        sessionStorage.setItem(OPEN_SIGNUP_KEY, "1");
      } catch {
        // The home page just opens without the form.
      }
      window.location.hash = "#/home";
    });

    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.className = "guest-signup-dismiss";
    dismiss.textContent = "Not now";
    dismiss.addEventListener("click", close);

    box.append(question, invitation, signUp, dismiss);
    root.append(box);
  };

  return {
    schedule() {
      if (scheduled) return;
      scheduled = true;
      timer = window.setTimeout(show, DELAY_MS);
    },
    dispose() {
      window.clearTimeout(timer);
      close();
    },
  };
}
