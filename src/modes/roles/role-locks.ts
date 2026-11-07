import { isRoleId, roleKind, type RoleId } from "../../../backend/src/game/wizard/modes/roles/roles";
import { COLOUR_WIZARDS, isColourWizard } from "../../../backend/src/game/wizard/modes/roles/master/colourWizards";
import type { ColorPoints } from "../../../backend/src/game/wizard/modes/roles/roleLocks";
import { COLOR_MASTERY_POINTS, isSuit } from "../../../backend/src/game/wizard/strongColor";
import { API_BASE } from "../../services/api";
import { t } from "../../i18n";

// Roles mode only. The roles still locked for the signed-in player
// (backend modes/roles/roleLocks.ts): greyed out with a lock in the
// Antechamber's role lists (pages/Room.ts calls it). The server refuses a
// locked role anyway; this only shows it.

export interface RoleAccess {
  // Every role open: an account from before the locks, or opened in Admin.
  allOpen: boolean;
  open: RoleId[];
  // Points of each strong colour: mastering one opens its colour Wizard.
  colorPoints: ColorPoints;
}

// Null when it cannot be had: nothing is shown locked then. token: the
// page's own (a guest's in a guest room), the signed-in player's when left out.
export async function loadRoleAccess(token?: string | null): Promise<RoleAccess | null> {
  try {
    const response = await fetch(`${API_BASE}/roles/open/me`, {
      headers: { Authorization: `Bearer ${token ?? localStorage.getItem("wizardToken") ?? ""}` },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { allOpen?: unknown; open?: unknown; colorPoints?: unknown };
    const open = Array.isArray(data.open) ? data.open.filter(isRoleId) : [];
    const colorPoints: ColorPoints = {};
    if (data.colorPoints && typeof data.colorPoints === "object") {
      for (const [suit, points] of Object.entries(data.colorPoints)) {
        if (isSuit(suit) && typeof points === "number") colorPoints[suit] = points;
      }
    }
    return { allOpen: data.allOpen === true, open, colorPoints };
  } catch {
    return null;
  }
}

// What opens a locked role, for its hint.
export function lockTip(role: RoleId): string {
  if (isColourWizard(role)) {
    const element = t(`suit.${COLOUR_WIZARDS[role].suit}`);
    return t("roles.locked.colourWizard", { element, points: String(COLOR_MASTERY_POINTS) });
  }
  if (role === "watcher") return t("roles.locked.watcher");
  if (roleKind(role) === "master") return t("roles.locked.joker");
  return t("roles.locked.basic");
}

// Each locked role's option: greyed out, a lock before its name, and what
// opens it as its hint.
export function lockRoleOptions(selects: readonly HTMLSelectElement[], open: readonly RoleId[]): void {
  for (const select of selects) {
    for (const option of select.options) {
      if (!isRoleId(option.value) || open.includes(option.value)) continue;
      option.disabled = true;
      option.textContent = `🔒 ${option.textContent?.trim() ?? ""}`;
      option.title = lockTip(option.value);
    }
  }
}
