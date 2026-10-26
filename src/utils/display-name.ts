// A guest's username is a generated id, which no one should have to read.
// A guest invited to a guest room chose a name, which follows the id
// (Guest-1a2b3c4d-Anna) and is shown on its own: "Anna". A guest playing alone
// from Home chose none (Guest-1a2b3c4d) and is a "Stranger" ("Gast" in
// German). The username itself is untouched: it is still what identifies them
// to the server, and the id keeps it unique when two guests choose one name.
import { t } from "../i18n";

export const GUEST_NAME_PATTERN = /^guest-/i;

const CHOSEN_GUEST_NAME = /^guest-[0-9a-f]{8}-(.+)$/i;

export const displayName = (username: string): string => {
  if (!GUEST_NAME_PATTERN.test(username)) {
    return username;
  }

  return CHOSEN_GUEST_NAME.exec(username)?.[1] ?? t("common.stranger");
};
