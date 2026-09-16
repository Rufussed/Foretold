// Bots are named "<name> NPC", e.g. "Morgana NPC": the suffix is what marks a
// player as a bot, for the server and the visualiser alike.
export const BOT_NAME_SUFFIX = " NPC";

export function isBotName(username: string): boolean {
  return username.endsWith(BOT_NAME_SUFFIX);
}
