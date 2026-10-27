// A code for each error message a player can meet, so the frontend can say it
// in the player's language (src/i18n/server-error.ts). The English message
// stays in every reply as it is; the code is added beside it when a reply
// goes out (server.ts, and the game socket), so no route has to change.
// Messages only an admin or a bug can cause have no code and stay English.

const MESSAGES = {
  // Accounts
  invalidCredentials: ["Invalid username or password"],
  credentialsRequired: ["Username and password are required"],
  fieldsRequired: ["All fields are required"],
  usernameTaken: ["Username is already in use"],
  usernameRules: ["Username must be 3-20 letters, numbers, _ or -"],
  npcNameReserved: ["Usernames ending in NPC are reserved for computer players"],
  usernameNotAllowed: ["Please choose a different username"],
  passwordTooShort: ["Password must contain at least 8 characters"],
  createUserFailed: ["Could not create user"],
  unauthorized: ["Unauthorized", "Invalid or missing token"],

  // The board
  postEmpty: ["Write something first"],
  logInToPost: ["Log in to post"],
  signUpToPost: ["Sign up to post on the board"],
  postNotFound: ["Post not found"],
  ownPostsOnly: ["You can only delete your own posts"],

  // Lobby and rooms
  roomNotFound: ["Room not found"],
  roomFull: ["Room is full"],
  roomNameRequired: ["Room name is required"],
  invalidRoom: ["Invalid room ID", "roomId is required"],
  gameStarted: ["Game already started"],
  notRoomMember: ["You are not a member of this room"],
  cannotLeaveRoom: ["You cannot leave this room"],
  onlyCreatorDeletes: ["Only the room creator can delete a waiting room"],
  privateRoomAccess: ["This is a private room. Only the creator's friends can access it."],
  privateRoomJoin: ["This is a private room. Only the creator's friends can join."],
  avatarTaken: ["That avatar is taken"],
  unknownAvatar: ["Unknown avatar"],
  avatarLocked: ["Avatars can only be changed before the game starts"],
  roleLocked: ["Roles can only be chosen before the game starts"],
  onlyHostRules: ["Only the host can choose the rule variations"],
  rulesLocked: ["Rule variations can only be changed before the game starts"],
  gameExists: ["A game already exists for this room"],
  playerCount: ["A Wizard game requires 3 to 6 players", "Wizard games require 3 to 6 players"],
  invalidBotCount: ["Invalid bot count"],
  createGameFailed: ["Could not create game"],
  createGuestFailed: ["Could not create guest game"],
  noGuestGame: ["No guest game to leave"],

  // Guest rooms and their invite links
  guestRoomOnly: ["This is a guest room. Only its invite link leads in."],
  guestCannotHost: ["Guests cannot open rooms"],
  inviteInvalid: ["This invitation is no longer valid"],
  guestNameInvalid: ["Names are 1-20 letters, digits or spaces"],
  guestNameProfane: ["Please choose a different name"],
  guestNameBot: ["Names ending in NPC are reserved for computer players"],
  onlyHostInvites: ["Only the host can invite"],
  guestPrefixReserved: ["Usernames starting with Guest- are reserved for guests"],

  // Friends and profiles
  friendRequestFailed: ["Could not send friend request"],
  friendAcceptFailed: ["Could not accept friend request"],
  friendRejectFailed: ["Could not reject friend request"],
  friendshipNotFound: ["Friendship not found"],
  playerNotFound: ["Player not found", "User not found"],

  // At the table
  gameNotFound: ["Game not found"],
  notAPlayer: ["You are not a player in this game"],
  watching: ["You are watching this game"],
  notYourTurn: ["It is not your turn", "It is not this player's turn"],
  cardNotPlayable: ["Card cannot be played"],
  cardsNotYet: ["Cards cannot be played yet"],
  trickComplete: ["The current trick is complete. Waiting for it to be resolved."],
  predictionsClosed: ["Predictions are not currently being accepted"],
  alreadyPredicted: ["Player has already submitted a prediction"],
  invalidPrediction: ["Invalid prediction", "Prediction must be a whole number"],
  trumpNotNow: ["Trump suit cannot be selected right now"],
  invalidTrumpSuit: ["Invalid trump suit"],
  timeUp: ["Time is up. The game will make the decision for you."],
  actionFailed: ["Action failed"],
} as const;

// Messages with a number in them; the number is passed on as a value.
const PATTERNS = {
  postTooLong: /^Posts can be at most (?<max>\d+) characters$/,
  postCooldown: /^Please wait (?<seconds>\d+) seconds between posts$/,
  maxRounds: /^Max rounds must be between 1 and (?<max>\d+)$/,
  guestRoomLimit: /^At most (?<count>\d+) guest rooms an hour$/,
} as const;

export type ErrorCode = keyof typeof MESSAGES | keyof typeof PATTERNS;

export interface CodedError {
  code: ErrorCode;
  values?: Record<string, string>;
}

const byMessage = new Map<string, ErrorCode>(
  Object.entries(MESSAGES).flatMap(([code, messages]) =>
    messages.map((message) => [message, code as ErrorCode] as const),
  ),
);

export function errorCode(message: string): CodedError | null {
  const code = byMessage.get(message);
  if (code) return { code };

  for (const [patternCode, pattern] of Object.entries(PATTERNS)) {
    const match = pattern.exec(message);
    if (match) return { code: patternCode as ErrorCode, values: { ...match.groups } };
  }

  return null;
}

// A reply body with its code added, when it is an error that has one. Any
// other body comes back untouched.
export function withErrorCode<T>(body: T): T {
  if (typeof body !== "object" || body === null || "code" in body) return body;

  const message = (body as { error?: unknown }).error;
  if (typeof message !== "string") return body;

  const coded = errorCode(message);
  return coded ? { ...body, ...coded } : body;
}
