import { isEffectsMuted, setEffectsMuted } from "./effects-mute";

const SPEAKER = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
const SPEAKER_OFF = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M3 3l18 18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>`;

export interface EffectsToggle {
  dispose(): void;
}

// A speaker button that mutes the sound effects: crossed out while muted. It
// sits between the music and fullscreen buttons at the top of the score panel.
export function createEffectsToggle(root: HTMLElement): EffectsToggle {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "effects-toggle";
  root.append(button);

  const render = () => {
    const muted = isEffectsMuted();
    button.innerHTML = muted ? SPEAKER_OFF : SPEAKER;
    const label = muted ? "Turn sound effects on" : "Mute sound effects";
    button.title = label;
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-pressed", String(muted));
  };

  button.addEventListener("click", () => {
    setEffectsMuted(!isEffectsMuted());
    render();
  });
  render();

  return {
    dispose() {
      button.remove();
    },
  };
}
