import type { CharacterId } from "../character-assets";
import type { GameConnection } from "../game-connection";
import { characterForPlayer } from "../seat-mapping";
import { headshotUrl } from "./headshots";
import type { HudPart } from "./hud-part";
import { createRoundStat, type RoundStat } from "./round-stats";

interface Row {
  element: HTMLElement;
  image: HTMLImageElement;
  prediction: RoundStat;
  won: RoundStat;
  character: CharacterId | null;
}

// At most this many characters of a name, the rest replaced by a full stop.
// The panel gives each player one short line, and a longer name would push the
// prediction and tricks columns out of line with the rows above and below.
const NAME_LIMIT = 10;

// trimEnd so a name cut mid-space reads "Balthazar." rather than "Balthazar .".
const shortName = (username: string) =>
  username.length > NAME_LIMIT ? `${username.slice(0, NAME_LIMIT).trimEnd()}.` : username;

// Bottom left: every other player in turn order, starting after you. Each is
// one line - a small headshot beside their name, then this round's prediction
// and tricks won, a labelled column each.
export function createOpponentGrid(root: HTMLElement, game: GameConnection): HudPart {
  const grid = document.createElement("section");
  grid.className = "hud-panel hud-opponents";
  grid.setAttribute("aria-label", "Other players");
  grid.hidden = true;
  root.append(grid);

  const rows = new Map<string, Row>();
  let order = "";

  const buildRow = (username: string): Row => {
    const element = document.createElement("div");
    element.className = "hud-opponent";

    const face = document.createElement("figure");
    face.className = "hud-opponent-face";
    const image = document.createElement("img");
    image.alt = "";
    const name = document.createElement("figcaption");
    name.textContent = shortName(username);
    // The full name is still available to a pointer and a screen reader.
    name.title = username;
    face.append(image, name);

    const prediction = createRoundStat("Prediction");
    const won = createRoundStat("Tricks");
    element.append(face, prediction.element, won.element);
    return { element, image, prediction, won, character: null };
  };

  return {
    applyState() {
      const state = game.state();
      if (!state) {
        grid.hidden = true;
        return;
      }

      const local = state.players.findIndex((player) => player.username === game.localUsername);
      const others =
        local === -1
          ? state.players
          : Array.from(
              { length: state.players.length - 1 },
              (_, step) => state.players[(local + 1 + step) % state.players.length],
            );

      const nextOrder = others.map((player) => player.username).join("\n");
      if (nextOrder !== order) {
        order = nextOrder;
        for (const username of rows.keys()) {
          if (!others.some((player) => player.username === username)) rows.delete(username);
        }
        grid.replaceChildren(
          ...others.map((player) => {
            let row = rows.get(player.username);
            if (!row) {
              row = buildRow(player.username);
              rows.set(player.username, row);
            }
            return row.element;
          }),
        );
      }

      for (const player of others) {
        const row = rows.get(player.username)!;
        row.prediction.set(player.prediction);
        row.won.set(player.tricksWon);

        const character = characterForPlayer(player);
        if (row.character !== character) {
          row.character = character;
          const target = row;
          headshotUrl(character)
            .then((url) => {
              if (target.character === character) target.image.src = url;
            })
            .catch((error) => console.warn(`[hud] no headshot for ${character}:`, error));
        }
      }

      grid.hidden = others.length === 0;
    },

    dispose() {
      grid.remove();
    },
  };
}
