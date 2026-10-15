// Faint guide lines in the bottom-left player panel, tying each stepped
// heading to its column: a line under the heading runs on to the gap after its
// column, turns down at 45 degrees, and runs down past every row. Drawn over
// the panel from the laid-out positions, since the columns are as wide as the
// names in the game.

const SVG = "http://www.w3.org/2000/svg";

// The 45-degree corner, in CSS pixels along each side.
const CORNER = 4;
// Where the line runs past the last column, which has no gap after it.
const LAST_COLUMN_OFFSET = 5;

export interface PlayerListGuides {
  element: SVGSVGElement;
  // Redraw from the panel's current layout.
  update(): void;
  dispose(): void;
}

// headings: one per column, in column order. columnCells: a row's cells, one
// per column, whose boxes are the columns' widths.
export function createPlayerListGuides(
  panel: HTMLElement,
  layout: () => { headings: HTMLElement[]; columnCells: HTMLElement[] } | null,
): PlayerListGuides {
  const svg = document.createElementNS(SVG, "svg");
  svg.classList.add("hud-opponent-guides");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(SVG, "path");
  svg.append(path);

  const update = () => {
    const parts = layout();
    if (!parts || panel.hidden) return;
    const box = panel.getBoundingClientRect();
    if (!box.width) return;
    // The HUD may be zoomed; draw in the panel's own unzoomed pixels.
    const scale = panel.offsetWidth / box.width;
    const x = (value: number) => (value - box.left) * scale;
    const y = (value: number) => (value - box.top) * scale;

    const columns = parts.columnCells.map((cell) => cell.getBoundingClientRect());
    const bottom = panel.offsetHeight - 6;
    const lines = parts.headings.map((heading, index) => {
      const text = heading.getBoundingClientRect();
      const next = columns[index + 1];
      // Midway through the gap to the next column, or just past the last one.
      const right = next
        ? (x(columns[index].right) + x(next.left)) / 2
        : x(columns[index].right) + LAST_COLUMN_OFFSET;
      const under = y(text.bottom) + 0.5;
      return `M ${x(text.left)} ${under} H ${right - CORNER} L ${right} ${under + CORNER} V ${bottom}`;
    });
    path.setAttribute("d", lines.join(" "));
  };

  const resizeObserver = new ResizeObserver(update);
  resizeObserver.observe(panel);

  return {
    element: svg,
    update,
    dispose() {
      resizeObserver.disconnect();
      svg.remove();
    },
  };
}
