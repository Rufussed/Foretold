// Anything a player typed (names, room names) must pass through this before it
// goes into innerHTML, or a name like <img onerror=...> runs as code in the
// browser of everyone who sees it.
export const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
