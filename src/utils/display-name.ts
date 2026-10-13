// A guest's username is a generated id (Guest-1a2b3c4d), which no one should
// have to read. Anywhere a player's name is shown, a guest is a "Stranger".
// The username itself is untouched: it is still what identifies them to the
// server.
export const GUEST_NAME_PATTERN = /^guest-/i;

export const displayName = (username: string): string =>
  GUEST_NAME_PATTERN.test(username) ? "Stranger" : username;
