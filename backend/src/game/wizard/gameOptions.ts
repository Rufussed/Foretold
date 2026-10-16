// The rule variations a host can choose in room setup, shared by the
// server (which plays by them) and the visualiser (which offers them and shows
// their effects). Like gameplayPace.ts it must stay free of Node-only code,
// because Vite bundles it into the browser.

export type WizardWins = "first" | "last";

export interface WizardGameOptions {
  // When more than one Wizard is played in a trick, whether the first or the
  // last one played takes it. "first" is the official rule.
  wizardWins: WizardWins;
  // The official blind variant: in the first round each player holds their one
  // card facing the others, so they see everyone's card except their own.
  blindFirstRound: boolean;
}

// What a new room starts with: the variations room setup offers selected.
export const DEFAULT_GAME_OPTIONS: WizardGameOptions = {
  wizardWins: "last",
  blindFirstRound: true,
};

// How the game was played before the variations existed: the official rules.
// What an older saved game with no options recorded at all is read as, so a
// game in progress never changes its rules when the defaults do.
export const LEGACY_GAME_OPTIONS: WizardGameOptions = {
  wizardWins: "first",
  blindFirstRound: false,
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
  };
};

// Whether a round is played blind: only the first, and only with the option on.
export const isBlindRound = (options: WizardGameOptions, round: number): boolean =>
  options.blindFirstRound && round === 1;
