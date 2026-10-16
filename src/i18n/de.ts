import type { MessageKey } from "./en";

// Game terms follow the German edition of Wizard (AMIGO): Zauberer, Narr,
// Trumpf, Stich, Ansage. Players are addressed with "du".
export const de: Record<MessageKey, string> = {
  "language.switchTo": "EN",
  "language.switchLabel": "Switch to English",

  "common.close": "Schließen",

  "nav.main": "Hauptmenü",
  "nav.about": "Über uns",
  "nav.rules": "Regeln",
  "nav.board": "Pinnwand",
  "nav.news": "News",

  "account.login": "Anmelden",
  "account.signup": "Registrieren",
  "account.logout": "Abmelden",

  "home.welcomeStranger": "Willkommen am Tisch",
  "home.welcome": "Willkommen",
  "home.welcomeName": "Willkommen, {name}",
  "home.play": "Jetzt spielen",
  "home.guestGameFailed": "Gastspiel konnte nicht gestartet werden",
  "home.legal": "Urheberrecht & Rechtliches",
  "home.contact": "Kontakt",

  "login.kicker": "Willkommen zurück",
  "login.title": "Anmelden",
  "login.username": "Benutzername",
  "login.password": "Passwort",
  "login.submit": "Anmelden",
  "login.toSignup": "Noch kein Konto? Registrieren",
  "login.failed": "Anmeldung fehlgeschlagen",

  "signup.kicker": "Setz dich an den Tisch",
  "signup.title": "Konto erstellen",
  "signup.username": "Benutzername",
  "signup.usernameHint": "3–20 Buchstaben, Ziffern, _ oder -",
  "signup.displayName": "Anzeigename",
  "signup.email": "E-Mail",
  "signup.password": "Passwort",
  "signup.submit": "Registrieren",
  "signup.toLogin": "Schon ein Konto? Anmelden",
  "signup.done": "Du bist registriert",
  "signup.failed": "Registrierung fehlgeschlagen",

  "news.title": "News",
  "news.kicker": "Neues von Wizard Platform.",
  "news.empty": "Hier erscheinen Neuigkeiten und Spiel-Updates.",

  "contact.title": "Kontakt",
  "contact.kicker": "Schreib dem Team",
  "contact.question": "Fragen, Feedback, Vorschläge oder Hinweise zum Urheberrecht?",
  "contact.emailUs": "Schreib uns an",

  "board.title": "Pinnwand",
  "board.kicker": "Worte vom Spieltisch",
  "board.label": "Auf die Pinnwand schreiben",
  "board.placeholder": "Suchst du heute Abend eine Runde? Sag Hallo.",
  "board.post": "Posten",
  "board.readOnly": "Die Pinnwand kann jeder lesen. {login}, um etwas zu schreiben.",
  "board.readOnlyLogin": "Melde dich an",
  "board.loading": "Wird geladen…",
  "board.empty": "Noch nichts hier. Schreib den ersten Beitrag!",
  "board.older": "Ältere Beiträge anzeigen",
  "board.delete": "Löschen",
  "board.confirmDelete": "Diesen Beitrag löschen?",
  "board.loadFailed": "Pinnwand konnte nicht geladen werden",
  "board.postFailed": "Beitrag konnte nicht gesendet werden",
  "board.deleteFailed": "Beitrag konnte nicht gelöscht werden",
};
