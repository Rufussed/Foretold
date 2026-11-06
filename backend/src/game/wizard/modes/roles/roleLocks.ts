import type { Suit } from "../../models/card.js";
import { COLOR_MASTERY_POINTS } from "../../strongColor.js";
import { COLOUR_WIZARDS, isColourWizard } from "./master/colourWizards.js";
import { rolesOfKind, type RoleId } from "./roles.js";
import { SEAL_LEVELS, sealPoints, type RoleRecord } from "./sealLevels.js";

// Roles mode only. Which roles a player may choose.
//   Basic roles   the first START_ROLES are open to everyone; each basic seal
//                 brought to Wood opens the next one in card order.
//   Master roles  none until every basic seal is Wood (the master option).
//                 Then each colour Wizard opens once its colour is mastered
//                 (COLOR_MASTERY_POINTS of the strong colour, strongColor.ts),
//                 and the Joker once every basic seal is Copper. The Watcher
//                 is free: open with the master roles.
// Accounts opened by hand (those made before the locks, or opened in Admin:
// roleAccess.ts) have every role open. Shared by the server and the browser
// (Antechamber, Profile), so it must stay free of Node-only code.

// How many basic roles are open from the start: Thief, Servant, Fisher, Farmer.
export const START_ROLES = 4;

type Records = readonly Pick<RoleRecord, "role" | "games" | "wins">[];
export type ColorPoints = Partial<Record<Suit, number>>;

const levelAt = (id: string): number => SEAL_LEVELS.find((level) => level.id === id)!.at;

const basicIds = () => rolesOfKind("basic").map((role) => role.id);

const reached = (records: Records, role: RoleId, level: string): boolean => {
  const record = records.find((entry) => entry.role === role);
  return record !== undefined && sealPoints(record) >= levelAt(level);
};

// Every basic seal at least at this level.
const allBasics = (records: Records, level: string): boolean =>
  basicIds().every((role) => reached(records, role, level));

// Whether a master role's own condition is met, the master option aside.
function masterEarned(role: RoleId, records: Records, colorPoints: ColorPoints): boolean {
  if (isColourWizard(role)) return (colorPoints[COLOUR_WIZARDS[role].suit] ?? 0) >= COLOR_MASTERY_POINTS;
  if (role === "joker") return allBasics(records, "copper");
  if (role === "watcher") return true;
  return false;
}

// The master option: every basic seal at Wood.
export const mastersOpen = (records: Records): boolean => allBasics(records, "wood");

export function openRoles(records: Records, allOpen: boolean, colorPoints: ColorPoints = {}): RoleId[] {
  const basics = basicIds();
  const masters = rolesOfKind("master").map((role) => role.id);
  if (allOpen) return [...basics, ...masters];

  const woods = basics.filter((role) => reached(records, role, "wood")).length;
  const open = basics.slice(0, Math.min(basics.length, START_ROLES + woods));
  if (!mastersOpen(records)) return open;
  return [...open, ...masters.filter((role) => masterEarned(role, records, colorPoints))];
}
