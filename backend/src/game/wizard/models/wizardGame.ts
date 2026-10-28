import type { AvatarId } from "./avatar.js";
import type { Card, Suit } from "./card.js";
import type { BotPersonality } from "../botLevels.js";
import type { WizardGameOptions } from "../gameOptions.js";
import type { RoleAction, RoleId } from "../modes/roles/roles.js";
import type { TurnTimeoutMs } from "../turnTimeout.js";

// A room member and the avatar they claimed, if any, while the room waits.
export interface RoomPlayer {
  username: string;
  avatar: AvatarId | null;
  // The role chosen for a Roles game; null until chosen.
  role: RoleId | null;
  // Sent for a running game only: the player quit it (playerQuit.ts).
  quit?: boolean;
}

// A lobby room exists before a game starts and keeps the player list used to
// initialize the game state.
export interface Room {
  id: number;
  name: string;
  createdAt: string;
  createdBy: number;
  createdByUsername: string;
  maxPlayers: number;
  isPublic: boolean;
  turnTimeoutMs: TurnTimeoutMs;
  players: RoomPlayer[];
  status: "waiting" | "playing";
  // The rule variations the host has chosen so far, shown to everyone waiting.
  options: WizardGameOptions;
  // Set on a guest room: the code in its invite link, the one way in. Its
  // games count for no one's stats.
  inviteCode: string | null;
}

export interface GamePlayer {
  username: string;
  avatar: AvatarId;
  hand: Card[];
  prediction: number | null;
  tricksWon: number;
  score: number;
  roundScores: RoundScore[];
  // How a bot plays (see bots/). Humans have none, and so do bots in games
  // saved before personalities existed; both are played as the Apprentice.
  botPersonality?: BotPersonality;
  // In a Roles game, the role played all game (modes/roles/). Missing in
  // Classic games and in games saved before roles existed.
  role?: RoleId;
  // This round's points from roles' powers so far, by role; already added to
  // score, and moved into the round's RoundScore when it ends.
  roleBonuses?: Partial<Record<RoleId, number>>;
  // Set when the player left for good, by choice or after missing three turns
  // in a row: the server plays their seat from then on (playerQuit.ts).
  quit?: boolean;
  // In a Roles game, the Farmers' seeds this player holds, by Farmer; they
  // stay from round to round until harvested (modes/roles/farmer.ts).
  seeds?: Record<string, number>;
  // The same for the Shepherds' sheep (modes/roles/shepherd.ts).
  sheep?: Record<string, number>;
  // Turns in a row the timer ran out on; a move of their own resets it.
  missedTurns?: number;
  // Tricks won this game with a card of each colour: no Wizard or Jester, and
  // none the server played for them. Their strong colour's count becomes
  // colour points at the end (strongColor.ts). Missing in older games.
  colorTricks?: Partial<Record<Suit, number>>;
}

// A played card retains its owner so the rules service can return a username
// rather than exposing internal player-array indexes.
export interface PlayedCard {
  username: string;
  card: Card;
  // The server played it for a human: their time ran out, or they quit. It
  // brings them no colour points (strongColor.ts).
  byServer?: true;
  // Who played it, kept when a role's power swaps its owner (modes/roles/).
  // Missing in games saved before roles existed.
  playedBy?: string;
}

export interface TrickState {
  playedCards: PlayedCard[];
  winnerUsername: string | null;
  // In a Roles game, the powers used in this trick, in order (modes/roles/).
  roleActions?: RoleAction[];
}

// "fishing": a Roles game's trick is complete and a Fisher picks a card from
// it before it is won (modes/roles/fisher.ts).
export type GamePhase = "trump-selection" | "predictions" | "playing" | "fishing" | "finished";

export interface WizardGameState {
  roomId: number;
  players: GamePlayer[];
  currentRound: number;
  totalRounds: number;
  startingPlayerIndex: number;
  currentPlayerIndex: number;
  trumpCard: Card | null;
  trumpSuit: Suit | null;
  currentTrick: TrickState;
  status: "waiting" | "playing" | "finished" | "expired";
  deck: Card[];
  phase: GamePhase;
  // How fast this game plays out; chosen in room setup. See gameplayPace.ts.
  // Games saved before the pace existed have none, so read it through
  // clampPace rather than trusting it.
  pace: number;
  // The advanced rules chosen in room setup. Games saved before they existed
  // have none, so read them through normalizeGameOptions.
  options?: WizardGameOptions;
  turnDeadlineAt: number | null;
  turnTimeoutMs: TurnTimeoutMs;
}

// This is the client-safe projection of WizardGameState. Other players' cards
// are omitted while hand sizes remain available to render the game UI. In a
// blind round it is the other way round: everyone's card but your own.
export interface PublicGamePlayer {
  username: string;
  avatar: AvatarId;
  hand: Card[];
  handCount: number;
  prediction: number | null;
  tricksWon: number;
  score: number;
  roundScores: RoundScore[];
  // The player has left; the server plays the seat (playerQuit.ts).
  quit: boolean;
  // Their role in a Roles game, known to all; null in Classic.
  role: RoleId | null;
  // The Farmers' seeds they hold, by Farmer; empty in Classic.
  seeds: Record<string, number>;
  // The Shepherds' sheep they hold, by Shepherd; empty in Classic.
  sheep: Record<string, number>;
}

export interface PublicWizardGameState {
  roomId: number;
  players: PublicGamePlayer[];
  currentRound: number;
  totalRounds: number;
  startingPlayerIndex: number;
  currentPlayerIndex: number;
  trumpCard: Card | null;
  trumpSuit: Suit | null;
  currentTrick: TrickState;
  status: "waiting" | "playing" | "finished";
  phase: GamePhase;
  deckCount: number;
  // The game's pace, so the visualiser scales its beats to match the server's.
  pace: number;
  options: WizardGameOptions;
  // True while this round is played blind (see gameOptions.ts).
  blindRound: boolean;
  turnDeadlineAt: number | null;
  turnTimeoutMs: TurnTimeoutMs;
}

export interface RoundScore {
  prediction: number;
  tricksWon: number;
  score: number;
  // In a Roles game, the points a role's power brought this round, by role,
  // already in the total (modes/roles/). Not part of score above.
  roleBonuses?: Partial<Record<RoleId, number>>;
}