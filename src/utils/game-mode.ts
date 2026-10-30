import { isGameMode, type GameMode } from "../../backend/src/game/wizard/modes/modes";
import { t } from "../i18n";

// A room's mode as sent by the server; an older room with none is Classic.
export function gameModeOf(options: { mode?: unknown } | null | undefined): GameMode {
  return isGameMode(options?.mode) ? options.mode : "classic";
}

export function gameModeName(mode: GameMode): string {
  return t(`mode.${mode}`);
}

// The mode's tag after a room's name, in the mode's colour (style.css,
// .mode-badge), with its one-line description as the hint.
export function gameModeBadge(mode: GameMode): string {
  return `<span class="mode-badge mode-${mode}" title="${t(`mode.${mode}.description`)}">${gameModeName(mode)}</span>`;
}
