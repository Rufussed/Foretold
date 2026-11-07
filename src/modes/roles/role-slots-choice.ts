import { t } from "../../i18n";

// Roles mode only. The host's choice in the room (src/pages/Room.ts) of how
// many roles each player plays: one basic role, or one basic and one master
// (backend modes/roles/rolePairs.ts). Saved to the room with its other rules,
// so everyone waiting sees it and picks their master role too.
export const roleSlotsChoice = (): string => `
  <label class="room-role-slots mode-roles" hidden>
    <span>${t("room.roleSlots")}</span>
    <select id="room-role-slots">
      <option value="one" selected>${t("room.roleSlots.one")}</option>
      <option value="pair">${t("room.roleSlots.pair")}</option>
    </select>
  </label>
`;
