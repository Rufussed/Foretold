import type { RoleId } from "../../../backend/src/game/wizard/modes/roles/roles";
import { getLanguage, t, type MessageKey } from "../../i18n";
import { ROLE_RULES, type RoleRules } from "./role-rules-texts";

// Roles mode only. A role's or power's rules card: its fixed fields in the
// same order for all, label beside text, the limits as a list. Used by the
// Roles help windows, the table's Roles panel and a seal's window.

const FIELDS: (keyof RoleRules)[] = ["card", "when", "effect", "points", "limits", "example"];

export function roleRulesHtml(role: RoleId): string {
  const rules = ROLE_RULES[role][getLanguage()];
  const rows = FIELDS.map((field) => {
    const value = rules[field];
    const text = Array.isArray(value)
      ? `<ul class="role-rules-limits">${value.map((limit) => `<li>${limit}</li>`).join("")}</ul>`
      : value;
    return `
      <div class="role-rules-row is-${field}">
        <dt>${t(`roles.field.${field}` as MessageKey)}</dt>
        <dd>${text}</dd>
      </div>
    `;
  });
  return `<dl class="role-rules">${rows.join("")}</dl>`;
}

// A role's rules in one line of plain text, for a hint on hover: what it
// does.
export const roleRulesHint = (role: RoleId): string => ROLE_RULES[role][getLanguage()].effect;
