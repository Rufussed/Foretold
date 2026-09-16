// Pacing for bots, so people at the table can follow what's happening.
export const WIZARD_TIMING = {
  // How long a bot "thinks" before choosing trumps after a Wizard or Jester is
  // turned up, so everyone can see who is choosing. Env BOT_TRUMP_DELAY_MS overrides.
  get botTrumpDelayMs(): number {
    const fromEnvironment = Number(process.env.BOT_TRUMP_DELAY_MS);
    return Number.isFinite(fromEnvironment) && process.env.BOT_TRUMP_DELAY_MS !== undefined ? fromEnvironment : 2500;
  },
  // How long a bot waits on its turn before playing a card, in milliseconds.
  // Set BOT_PLAY_DELAY_MS in the environment to override it.
  get botPlayDelayMs(): number {
    const fromEnvironment = Number(process.env.BOT_PLAY_DELAY_MS);
    return Number.isFinite(fromEnvironment) ? fromEnvironment : 4000;
  },
};
