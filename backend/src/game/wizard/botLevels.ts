// How well the NPCs play, chosen in room setup. Shared by the server (which
// gives each bot its personality) and the room page (which offers the
// choice), so like gameOptions.ts it must stay free of Node-only code.

// The ways a bot can play. See bots/ for what each one does.
export type BotPersonality = "apprentice" | "adept";

// What the host picks: one personality for every bot, or a random mix.
export type BotLevel = BotPersonality | "mixed";

export const BOT_PERSONALITIES: readonly BotPersonality[] = ["apprentice", "adept"];

export const BOT_LEVELS: readonly { level: BotLevel; label: string }[] = [
  { level: "apprentice", label: "Apprentice: plays by instinct" },
  { level: "adept", label: "Adept: plays to its prediction" },
  { level: "mixed", label: "Mixed: a bit of both" },
];

export const DEFAULT_BOT_LEVEL: BotLevel = "apprentice";

// The level to use, given whatever a client sent.
export const normalizeBotLevel = (value: unknown): BotLevel =>
  BOT_LEVELS.some(({ level }) => level === value) ? (value as BotLevel) : DEFAULT_BOT_LEVEL;
