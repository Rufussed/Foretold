import type { BotLevel, BotPersonality } from "../botLevels.js";
import { BOT_PERSONALITIES } from "../botLevels.js";
import { isBotName } from "../models/bot.js";
import type { GamePlayer } from "../models/wizardGame.js";
import { adept } from "./adept.js";
import { apprentice } from "./apprentice.js";
import type { BotStrategy } from "./personality.js";

const STRATEGIES: Record<BotPersonality, BotStrategy> = {
  apprentice,
  adept,
};

// How a player's moves are made for them: their own personality for a bot,
// the Apprentice for a bot from a game saved before personalities existed and
// for a human whose time ran out.
export const strategyFor = (player: GamePlayer): BotStrategy =>
  STRATEGIES[player.botPersonality ?? "apprentice"];

// Gives each bot in a new game its personality: the host's chosen level, or a
// random one each for a mixed table.
export function assignBotPersonalities(
  players: GamePlayer[],
  level: BotLevel,
  random: () => number = Math.random,
): void {
  for (const player of players) {
    if (!isBotName(player.username)) continue;

    player.botPersonality =
      level === "mixed"
        ? (BOT_PERSONALITIES[Math.floor(random() * BOT_PERSONALITIES.length)] ?? "apprentice")
        : level;
  }
}
