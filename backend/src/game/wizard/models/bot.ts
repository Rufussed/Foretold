// Bots are named "<name> NPC", e.g. "Morgana NPC": the suffix is what marks a
// player as a bot, for the server and the visualiser alike.
export const BOT_NAME_SUFFIX = " NPC";

export function isBotName(username: string): boolean {
  return username.endsWith(BOT_NAME_SUFFIX);
}

// A game can be all NPCs: the host's seat then goes to "<host> NPC", which
// they watch play. The name a user sits under in a game, or null if they
// aren't in it.
export function seatNameFor(username: string, players: readonly { username: string }[]): string | null {
  if (players.some((player) => player.username === username)) return username;
  const watched = `${username}${BOT_NAME_SUFFIX}`;
  return players.some((player) => player.username === watched) ? watched : null;
}
