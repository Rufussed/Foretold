// A labelled number, as shown for this round's prediction and tricks won.
export interface RoundStat {
  element: HTMLElement;
  set(value: number | null): void;
  // Swells the number and flashes it for a second, to draw the eye to a
  // change it did not make itself (see .is-flashing in the stylesheet).
  flash(): void;
}

export interface RoundStatOptions {
  // Keeps the label out of sight while leaving it for screen readers: for a
  // list of players under one set of column headings, where showing it on
  // every row would just repeat the heading.
  labelHidden?: boolean;
}

// "–" until there's a number to show, such as before a prediction is made.
export function createRoundStat(label: string, options: RoundStatOptions = {}): RoundStat {
  const element = document.createElement("div");
  element.className = "hud-stat";
  const labelEl = document.createElement("span");
  labelEl.className = options.labelHidden ? "hud-stat-label is-hidden" : "hud-stat-label";
  labelEl.textContent = label;
  const valueEl = document.createElement("span");
  valueEl.className = "hud-stat-value";
  valueEl.textContent = "–";
  element.append(labelEl, valueEl);

  return {
    element,
    set(value) {
      valueEl.textContent = value === null ? "–" : String(value);
    },

    flash() {
      // Restarts the animation if one is still running.
      valueEl.classList.remove("is-flashing");
      void valueEl.offsetWidth;
      valueEl.classList.add("is-flashing");
      valueEl.addEventListener("animationend", () => valueEl.classList.remove("is-flashing"), { once: true });
    },
  };
}
