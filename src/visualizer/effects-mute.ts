// The mute for sound effects (the card and score sounds). The music has its own
// button, so a player can silence either or both. Remembered in this browser.
const KEY = "wizard-effects-muted";

const read = (): boolean => {
  try {
    return localStorage.getItem(KEY) === "true";
  } catch {
    return false;
  }
};

let muted = read();
const listeners = new Set<() => void>();

export const isEffectsMuted = (): boolean => muted;

export function setEffectsMuted(next: boolean): void {
  if (next === muted) return;
  muted = next;
  try {
    localStorage.setItem(KEY, String(next));
  } catch {
    // Storage unavailable: the choice lasts for this visit only.
  }
  for (const listener of [...listeners]) listener();
}

// Calls this whenever the effects mute changes; returns how to stop.
export function onEffectsMuteChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
