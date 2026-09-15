import type { BackgroundMusic } from "./background-music";

const NOTE = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l11-2v13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6" cy="18" r="3" fill="currentColor"/><circle cx="17" cy="16" r="3" fill="currentColor"/></svg>`;
const NOTE_OFF = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l11-2v13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6" cy="18" r="3" fill="currentColor"/><circle cx="17" cy="16" r="3" fill="currentColor"/><path d="M3 3l18 18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>`;

export interface MusicToggle {
  dispose(): void;
}

// A button to mute and unmute the music: a music note while it plays, the note
// crossed out while muted. Sits over the top-right corner of the score panel.
export function createMusicToggle(root: HTMLElement, music: BackgroundMusic): MusicToggle {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "music-toggle";
  root.append(button);

  const render = () => {
    button.innerHTML = music.muted ? NOTE_OFF : NOTE;
    const label = music.muted ? "Play music" : "Mute music";
    button.title = label;
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-pressed", String(music.muted));
  };

  button.addEventListener("click", () => {
    music.setMuted(!music.muted);
    render();
  });
  render();

  return {
    dispose() {
      button.remove();
    },
  };
}
