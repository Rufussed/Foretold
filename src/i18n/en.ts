// English is the source language: every key the site uses is listed here,
// and de.ts must translate each one (the type checker says which are missing).
// "{name}" in a text is filled in by t(key, { name }).
export const en = {
  "language.switchTo": "DE",
  "language.switchLabel": "Auf Deutsch wechseln",

  "common.close": "Close",

  "nav.main": "Main navigation",
  "nav.about": "About",
  "nav.rules": "Rules",
  "nav.board": "Board",
  "nav.news": "News",

  "account.login": "Log in",
  "account.signup": "Sign up",
  "account.logout": "Log out",

  "home.welcomeStranger": "Welcome, Stranger",
  "home.welcome": "Welcome",
  "home.welcomeName": "Welcome, {name}",
  "home.play": "Play Now",
  "home.guestGameFailed": "Could not start guest game",
  "home.legal": "Copyright & Legal",
  "home.contact": "Contact",

  "login.kicker": "Welcome back",
  "login.title": "Log in",
  "login.username": "Username",
  "login.password": "Password",
  "login.submit": "Log in",
  "login.toSignup": "Need an account? Sign up",
  "login.failed": "Login failed",

  "signup.kicker": "Join the table",
  "signup.title": "Create account",
  "signup.username": "Username",
  "signup.usernameHint": "3-20 letters, numbers, _ or -",
  "signup.displayName": "Display name",
  "signup.email": "Email",
  "signup.password": "Password",
  "signup.submit": "Sign up",
  "signup.toLogin": "Already have an account? Log in",
  "signup.done": "You are signed up",
  "signup.failed": "Registration failed",

  "news.title": "News",
  "news.kicker": "Wizard Platform updates.",
  "news.empty": "News and game updates will appear here.",

  "contact.title": "Contact",
  "contact.kicker": "Reach the team",
  "contact.question": "Questions, feedback, suggestions, or copyright concerns?",
  "contact.emailUs": "Email us at",

  "board.title": "Board",
  "board.kicker": "Words from the table",
  "board.label": "Write on the board",
  "board.placeholder": "Looking for a game tonight? Say hello.",
  "board.post": "Post",
  "board.readOnly": "Anyone can read the board. {login} to write on it.",
  "board.readOnlyLogin": "Log in",
  "board.loading": "Loading…",
  "board.empty": "Nothing here yet. Be the first!",
  "board.older": "Show older posts",
  "board.delete": "Delete",
  "board.confirmDelete": "Delete this post?",
  "board.loadFailed": "Could not load the board",
  "board.postFailed": "Could not post",
  "board.deleteFailed": "Could not delete the post",
};

export type MessageKey = keyof typeof en;
