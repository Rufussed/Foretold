import { t } from "../../i18n";
import { DEFAULT_NPC_ROLES, NPC_ROLES } from "../../../backend/src/game/wizard/modes/roles/npcRoles";

// Roles mode only. The host's choice in the room (src/pages/Room.ts) of
// which roles the NPCs draw: basic only, master only, or any of both. Sent
// with the start of the game; the server draws them in assignRoles.ts.
export const npcRolesChoice = (): string => `
  <label class="room-npc-roles mode-roles" hidden>
    <span>${t("room.npcRoles")}</span>
    <select id="room-npc-roles">
      ${NPC_ROLES.map(
        (choice) =>
          `<option value="${choice}"${choice === DEFAULT_NPC_ROLES ? " selected" : ""}>${t(`room.npcRoles.${choice}`)}</option>`,
      ).join("")}
    </select>
  </label>
`;
