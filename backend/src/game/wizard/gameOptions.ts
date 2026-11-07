// The rule variations a host can choose in room setup, shared by the
// server (which plays by them) and the visualiser (which offers them and shows
// their effects). Like gameplayPace.ts it must stay free of Node-only code,
// because Vite bundles it into the browser.

import { isGameMode, type GameMode } from "./modes/modes.js";

export type WizardWins = "first" | "last";

// How many turns in a row a player may let the timer run out on before they
// count as gone and the server plays their seat to the end (see the backend's
// playerQuit.ts); null never puts anyone out.
export const MISSED_TURNS_OPTIONS = [3, 5, 7, 9, null] as const;

export type MissedTurnsToQuit = (typeof MISSED_TURNS_OPTIONS)[number];

export const isMissedTurnsToQuit = (value: unknown): value is MissedTurnsToQuit =>
  MISSED_TURNS_OPTIONS.some((option) => option === value);

export interface WizardGameOptions {
  // Which game is played (modes/modes.ts). Classic unless the host chose
  // another.
  mode: GameMode;
  // When more than one Wizard is played in a trick, whether the first or the
  // last one played takes it. "first" is the official rule.
  wizardWins: WizardWins;
  // The official blind variant: in the first round each player holds their one
  // card facing the others, so they see everyone's card except their own.
  blindFirstRound: boolean;
  // Missed turns in a row that count as leaving the game; null for never.
  missedTurnsToQuit: MissedTurnsToQuit;
  // The last player to predict in a round may not make everyone's predictions
  // add up to the round's tricks, so at least one player must miss. false
  // lets them choose anything (gameplayRules.ts).
  lastPredictionLimited: boolean;
  // Roles mode only: every player plays one basic role and one master role
  // (modes/roles/rolePairs.ts); false, one basic role each.
  rolePair: boolean;
}

// What every new room starts with: the official rules (you see your own
// cards, the first Wizard wins). The host can switch variations on per room.
export const DEFAULT_GAME_OPTIONS: WizardGameOptions = {
  mode: "classic",
  wizardWins: "first",
  blindFirstRound: false,
  missedTurnsToQuit: 5,
  lastPredictionLimited: true,
  rolePair: false,
};

// What a new room of a given mode starts with. Expanded (sabotage) starts with
// the last Wizard winning and a blind first round; the other modes start with
// the official rules. The host can still change either one.
export const defaultGameOptions = (mode: GameMode): WizardGameOptions =>
  mode === "sabotage"
    ? { ...DEFAULT_GAME_OPTIONS, mode, wizardWins: "last", blindFirstRound: true }
    : { ...DEFAULT_GAME_OPTIONS, mode };

// How the game was played before the variations existed: the official rules.
// What an older saved game with no options recorded at all is read as, so a
// game in progress never changes its rules when the defaults do.
export const LEGACY_GAME_OPTIONS: WizardGameOptions = {
  mode: "classic",
  wizardWins: "first",
  blindFirstRound: false,
  missedTurnsToQuit: null,
  // Before it was a choice, the last prediction was always limited.
  lastPredictionLimited: true,
  rolePair: false,
};

// The options to actually use, given whatever arrived from a client or an
// older saved game with no options recorded at all. Anything not given is
// taken from fallback.
export const normalizeGameOptions = (
  value: unknown,
  fallback: WizardGameOptions = LEGACY_GAME_OPTIONS,
): WizardGameOptions => {
  const raw = (typeof value === "object" && value !== null ? value : {}) as Partial<
    Record<keyof WizardGameOptions, unknown>
  >;
  return {
    mode: isGameMode(raw.mode) ? raw.mode : fallback.mode,
    wizardWins: raw.wizardWins === "last" || raw.wizardWins === "first" ? raw.wizardWins : fallback.wizardWins,
    blindFirstRound: typeof raw.blindFirstRound === "boolean" ? raw.blindFirstRound : fallback.blindFirstRound,
    missedTurnsToQuit: isMissedTurnsToQuit(raw.missedTurnsToQuit)
      ? raw.missedTurnsToQuit
      : fallback.missedTurnsToQuit,
    lastPredictionLimited:
      typeof raw.lastPredictionLimited === "boolean" ? raw.lastPredictionLimited : fallback.lastPredictionLimited,
    rolePair: typeof raw.rolePair === "boolean" ? raw.rolePair : fallback.rolePair,
  };
};

// Whether a round is played blind: only the first, and only with the option on.
export const isBlindRound = (options: WizardGameOptions, round: number): boolean =>
  options.blindFirstRound && round === 1;
