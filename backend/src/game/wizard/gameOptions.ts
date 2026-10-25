// The rule variations a host can choose in room setup, shared by the
// server (which plays by them) and the visualiser (which offers them and shows
// their effects). Like gameplayPace.ts it must stay free of Node-only code,
// because Vite bundles it into the browser.

export type WizardWins = "first" | "last";

// How many turns in a row a player may let the timer run out on before they
// count as gone and the server plays their seat to the end (see the backend's
// playerQuit.ts); null never puts anyone out.
export const MISSED_TURNS_OPTIONS = [3, 5, 7, 9, null] as const;

export type MissedTurnsToQuit = (typeof MISSED_TURNS_OPTIONS)[number];

export const isMissedTurnsToQuit = (value: unknown): value is MissedTurnsToQuit =>
  MISSED_TURNS_OPTIONS.some((option) => option === value);

export interface WizardGameOptions {
  // When more than one Wizard is played in a trick, whether the first or the
  // last one played takes it. "first" is the official rule.
  wizardWins: WizardWins;
  // The official blind variant: in the first round each player holds their one
  // card facing the others, so they see everyone's card except their own.
  blindFirstRound: boolean;
  // Missed turns in a row that count as leaving the game; null for never.
  missedTurnsToQuit: MissedTurnsToQuit;
}

// What every new room starts with: the official rules (you see your own
// cards, the first Wizard wins). The host can switch variations on per room.
export const DEFAULT_GAME_OPTIONS: WizardGameOptions = {
  wizardWins: "first",
  blindFirstRound: false,
  missedTurnsToQuit: 5,
};

// How the game was played before the variations existed: the official rules.
// What an older saved game with no options recorded at all is read as, so a
// game in progress never changes its rules when the defaults do.
export const LEGACY_GAME_OPTIONS: WizardGameOptions = {
  wizardWins: "first",
  blindFirstRound: false,
  missedTurnsToQuit: null,
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
    wizardWins: raw.wizardWins === "last" || raw.wizardWins === "first" ? raw.wizardWins : fallback.wizardWins,
    blindFirstRound: typeof raw.blindFirstRound === "boolean" ? raw.blindFirstRound : fallback.blindFirstRound,
    missedTurnsToQuit: isMissedTurnsToQuit(raw.missedTurnsToQuit)
      ? raw.missedTurnsToQuit
      : fallback.missedTurnsToQuit,
  };
};

// Whether a round is played blind: only the first, and only with the option on.
export const isBlindRound = (options: WizardGameOptions, round: number): boolean =>
  options.blindFirstRound && round === 1;
