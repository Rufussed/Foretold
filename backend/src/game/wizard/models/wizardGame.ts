import type { AvatarId } from "./avatar.js";
import type { Card, CardPower, Suit } from "./card.js";
import type { BotPersonality } from "../botLevels.js";
import type { WizardGameOptions } from "../gameOptions.js";
import type { TurnTimeoutMs } from "../turnTimeout.js";

// A room member and the avatar they claimed, if any, while the room waits.
export interface RoomPlayer {
  username: string;
  avatar: AvatarId | null;
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
}

// A played card retains its owner so the rules service can return a username
// rather than exposing internal player-array indexes.
export interface PlayedCard {
  username: string;
  card: Card;
}

// What winning a trick with a Seer, a Trickster or a Thief did. It starts
// unresolved, while the winner decides; resolving it fills in the rest.
export interface TrickPower {
  kind: CardPower;
  // Who won the trick with the card, and so who uses the power.
  username: string;
  resolved: boolean;
  // Whose prediction changed (the winner's own for a Seer), the number it was
  // and the number it became. All null when the winner left it alone.
  target: string | null;
  from: number | null;
  to: number | null;
  // The Thief's swap: the winner picks a player first (target is set then, so
  // that player can be told), then a card of their own and one of the target's.
  // These are the hand positions that traded places, null until it happens.
  // Cards themselves are never recorded here: everyone sees this.
  ownIndex?: number | null;
  targetIndex?: number | null;
}

export interface TrickState {
  playedCards: PlayedCard[];
  winnerUsername: string | null;
  // Set when the winning card was a Seer, a Trickster or a Thief.
  power?: TrickPower;
}

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
  phase: "trump-selection" | "predictions" | "playing" | "power" | "finished";
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
  phase: "trump-selection" | "predictions" | "playing" | "power" | "finished";
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
}