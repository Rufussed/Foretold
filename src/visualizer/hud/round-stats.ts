// A labelled number, as shown for this round's prediction and tricks won.
export interface RoundStat {
  element: HTMLElement;
  set(value: number | null): void;
}

// "–" until there's a number to show, such as before a prediction is made.
export function createRoundStat(label: string): RoundStat {
  const element = document.createElement("div");
  element.className = "hud-stat";
  const labelEl = document.createElement("span");
  labelEl.className = "hud-stat-label";
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
  };
}
