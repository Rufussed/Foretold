import { displayName } from "../../utils/display-name";
import { seedCount } from "../../../backend/src/game/wizard/modes/roles/farmer";
import type { CharacterId } from "../character-assets";
import type { GameConnection } from "../game-connection";
import { characterForPlayer } from "../seat-mapping";
import { headshotUrl } from "./headshots";
import { createPlayerListGuides } from "./player-list-guides";
import type { HudPart } from "./hud-part";
import { createRoundStat, type RoundStat } from "./round-stats";
import { t } from "../../i18n";

interface Row {
  element: HTMLElement;
  image: HTMLImageElement;
  prediction: RoundStat;
  won: RoundStat;
  character: CharacterId | null;
}

// At most this many characters of a name. The panel gives each player one
// short line, and a longer name would push the prediction and tricks columns
// out of line with the rows above and below.
const NAME_LIMIT = 10;

// The first word, which for an NPC drops the " NPC" the server appends and
// leaves the character's own name. A single word longer than the limit is cut
// and ends in a full stop to show it was; a name shortened at a space is a
// whole word already, so it needs no mark.
const shortName = (username: string) => {
  const firstWord = displayName(username).split(" ")[0] ?? username;
  return firstWord.length > NAME_LIMIT ? `${firstWord.slice(0, NAME_LIMIT)}.` : firstWord;
};

// Where tricks won stand against the prediction, in the tesseract burst's
// colours: green while short of it, gold on it, red over it.
const standing = (won: number, prediction: number | null) =>
  prediction === null ? "none" : won < prediction ? "under" : won === prediction ? "met" : "over";

export interface PlayerListOptions {
  // The round the card table is showing, undefined before it has one. The list
  // runs ahead of the table once a round is scored, until the next deal starts.
  tableRound?(): number | undefined;
  // Whether the current move's player has been announced. The highlight moves
  // to them then, not when their turn begins on the server.
  turnShown?(): boolean;
}

// Bottom left: every player, you included, in the order they predict this
// round: the first to predict first, the second second, and so on. The first
// player moves on each deal, so the list reorders with it. Each is one line - a
// small headshot beside their name, then this round's prediction and tricks
// won, a column each. Your own line is picked out, and so is whoever's move
// it is.
export function createPlayerList(
  root: HTMLElement,
  game: GameConnection,
  options: PlayerListOptions = {},
): HudPart {
  const grid = document.createElement("section");
  grid.className = "hud-panel hud-opponents";
  grid.setAttribute("aria-label", t("game.players"));
  grid.hidden = true;
  root.append(grid);

  // One set of column headings for the whole panel; the rows below carry only
  // their numbers. Each heading is one line, ending over the end of its own
  // column, stepped so the later columns' headings sit higher and run back
  // over the earlier columns without meeting.
  const headings = document.createElement("div");
  headings.className = "hud-opponent hud-opponent-headings";
  headings.setAttribute("aria-hidden", "true");
  const headingFor = (text: string, column: string) => {
    const cell = document.createElement("span");
    cell.className = `hud-stat-label hud-heading-${column}`;
    cell.textContent = text;
    return cell;
  };
  const orderHeading = headingFor(t("game.playOrder"), "order");
  const predictionsHeading = headingFor(t("game.predictions"), "predictions");
  const tricksHeading = headingFor(t("game.tricks"), "tricks");
  headings.append(tricksHeading, predictionsHeading, orderHeading);

  const rows = new Map<string, Row>();
  let order = "";
  // Who is highlighted: the player whose move was last announced.
  let highlighted: string | undefined;

  // Faint lines from each heading down its column.
  const guides = createPlayerListGuides(grid, () => {
    const first = rows.get(order.split("\n")[0] ?? "");
    if (!first) return null;
    return {
      headings: [orderHeading, predictionsHeading, tricksHeading],
      columnCells: [...first.element.children] as HTMLElement[],
    };
  });

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
    name.title = displayName(username);
    face.append(image, name);

    // Labels hidden: the headings above say it once, but each row keeps its
    // own for anyone listening rather than looking.
    const prediction = createRoundStat(t("game.prediction"), { labelHidden: true });
    const won = createRoundStat(t("game.tricks"), { labelHidden: true });
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

      // Predictions go round in dealing order, from the round's first player.
      const count = state.players.length;
      const players = Array.from(
        { length: count },
        (_, step) => state.players[(state.startingPlayerIndex + step) % count],
      );

      // Between a round's end and the next deal, the list keeps showing the
      // round just played - its order, predictions and tricks - while its
      // scores are read out; the new round's blanks come with the deal.
      const tableRound = options.tableRound?.();
      const holding = tableRound !== undefined && tableRound < state.currentRound && order !== "";

      const nextOrder = players.map((player) => player.username).join("\n");
      if (!holding && nextOrder !== order) {
        order = nextOrder;
        for (const username of rows.keys()) {
          if (!players.some((player) => player.username === username)) rows.delete(username);
        }
        grid.replaceChildren(
          headings,
          guides.element,
          ...players.map((player) => {
            let row = rows.get(player.username);
            if (!row) {
              row = buildRow(player.username);
              rows.set(player.username, row);
            }
            return row.element;
          }),
        );
      }

      // Whose move it is, once it has been announced; until then, whoever's
      // move was announced last. Nobody between rounds or once it's over.
      if (holding || state.phase === "finished") {
        highlighted = undefined;
      } else if (options.turnShown?.() ?? true) {
        highlighted = state.players[state.currentPlayerIndex]?.username;
      }
      const current = highlighted;

      for (const player of players) {
        const row = rows.get(player.username)!;
        row.element.classList.toggle("is-you", player.username === game.localUsername);
        row.element.classList.toggle("is-current", player.username === current);
        // A player who quit: their line dims, and the server plays the seat.
        row.element.classList.toggle("has-quit", player.quit);
        const caption = row.element.querySelector("figcaption");
        if (caption) {
          // In a Roles game the line shows the player's role, as the name is
          // already in the scores at the top; the name stays in the hint.
          // A Farmer's seeds they carry follow it, e.g. "Thief 🌱2".
          const seeds = seedCount(player.seeds);
          const marks = seeds ? ` \u{1F331}${seeds}` : "";
          caption.textContent = player.role ? `${t(`role.${player.role}`)}${marks}` : shortName(player.username);
          caption.title = player.quit
            ? t("game.playerQuit", { name: displayName(player.username) })
            : seeds
              ? `${displayName(player.username)} \u00b7 ${t("game.seeds", { count: String(seeds) })}`
              : displayName(player.username);
        }
        const played = holding ? player.roundScores.at(-1) : undefined;
        const prediction = played ? played.prediction : player.prediction;
        const tricksWon = played ? played.tricksWon : player.tricksWon;
        row.prediction.set(prediction);
        row.won.set(tricksWon);
        row.won.element.dataset.standing = standing(tricksWon, prediction);

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

      grid.hidden = players.length === 0;
      guides.update();
    },

    dispose() {
      guides.dispose();
      grid.remove();
    },
  };
}
