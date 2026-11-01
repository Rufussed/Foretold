import type { RoleId } from "../../../backend/src/game/wizard/modes/roles/roles";
import farmer from "../../assets/role-seals/seal-power-farmer.png";
import fisher from "../../assets/role-seals/seal-power-fisher.png";
import merchant from "../../assets/role-seals/seal-power-merchant.png";
import priest from "../../assets/role-seals/seal-power-priest.png";
import servant from "../../assets/role-seals/seal-power-servant.png";
import shepherd from "../../assets/role-seals/seal-power-shepherd.png";
import smith from "../../assets/role-seals/seal-power-smith.png";
import thief from "../../assets/role-seals/seal-power-thief.png";
import warrior from "../../assets/role-seals/seal-power-warrior.png";
import gambler from "../../assets/role-seals/seal-power-gambler.png";
import duke from "../../assets/role-seals/seal-power-duke.png";
import prophet from "../../assets/role-seals/seal-power-prophet.png";
import king from "../../assets/role-seals/seal-power-king.png";
import blue from "../../assets/role-seals/seal-colour-blue.png";
import green from "../../assets/role-seals/seal-colour-green.png";
import red from "../../assets/role-seals/seal-colour-red.png";
import yellow from "../../assets/role-seals/seal-colour-yellow.png";
import joker from "../../assets/role-seals/seal-master-joker.png";

// Roles mode only. Each role's wax seal picture, apart from the 3D table code
// (role-seals.ts) so pages like the Profile can show them without it.

const URLS: Partial<Record<RoleId, string>> = {
  thief, servant, fisher, farmer, shepherd, smith, merchant, priest, warrior, gambler, duke, prophet, king,
  blueWizard: blue, greenWizard: green, yellowWizard: yellow, redWizard: red, joker,
};

// A role's seal picture, for the HUD's lists and the Profile's seals.
export const roleSealUrl = (role: RoleId): string | undefined => URLS[role];
