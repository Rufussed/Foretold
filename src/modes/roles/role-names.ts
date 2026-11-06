import { roleKind, rolesHeld, type RoleId } from "../../../backend/src/game/wizard/modes/roles/roles";
import { t } from "../../i18n";

// Roles mode only. A player's roles as one name: "Thief", or with a master
// power too (a basic + master game) the pair, "Fire Thief" ("Dieb des
// Feuers"); an older game with a master as its one role, "Power of Fire".

const PAIR_KEYS = {
  blueWizard: "role.pair.blueWizard",
  greenWizard: "role.pair.greenWizard",
  yellowWizard: "role.pair.yellowWizard",
  redWizard: "role.pair.redWizard",
  joker: "role.pair.joker",
  watcher: "role.pair.watcher",
} as const;

const pairKey = (role: RoleId) => (role in PAIR_KEYS ? PAIR_KEYS[role as keyof typeof PAIR_KEYS] : null);

export function rolesName(player: { role?: RoleId | null; masterRole?: RoleId | null }): string {
  const basic = player.role && roleKind(player.role) === "basic" ? player.role : null;
  const key = player.masterRole ? pairKey(player.masterRole) : null;
  if (basic && key) return t(key, { role: t(`role.${basic}`) });
  return rolesHeld(player).map((role) => t(`role.${role}`)).join(" · ");
}
