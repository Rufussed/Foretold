import { de } from "./de";
import { en, type MessageKey } from "./en";

export type { MessageKey };
export type Language = "en" | "de";

const LANGUAGE_KEY = "wizardLanguage";
const dictionaries: Record<Language, Record<MessageKey, string>> = { en, de };

// A choice made with the switch wins; otherwise a German browser starts in
// German and everyone else in English.
function initialLanguage(): Language {
  try {
    const saved = localStorage.getItem(LANGUAGE_KEY);
    if (saved === "en" || saved === "de") return saved;
  } catch {
    // No storage: fall back to the browser's language.
  }

  return navigator.language.toLowerCase().startsWith("de") ? "de" : "en";
}

let current: Language = initialLanguage();
document.documentElement.lang = current;

export function getLanguage(): Language {
  return current;
}

// Texts are ours and may hold markup; a value from a player (a name) must be
// escaped by the caller before it goes in.
export function t(key: MessageKey, values: Record<string, string> = {}): string {
  return dictionaries[current][key].replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? values[name] : match,
  );
}

// Pages draw their text once, so the current page is drawn again in the new
// language, the same way the router redraws it on a link.
export function setLanguage(language: Language): void {
  current = language;
  document.documentElement.lang = language;

  try {
    localStorage.setItem(LANGUAGE_KEY, language);
  } catch {
    // Not remembered, but the page still switches.
  }

  window.dispatchEvent(new HashChangeEvent("hashchange"));
}
