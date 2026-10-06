// Pacing for bots and for the server's own pauses, so people at the table can
// follow what's happening. Every value is in milliseconds at the default pace;
// the game's pace divides them (see gameplayPace.ts), and the runner applies
// that in one place, in its wait().
export const WIZARD_TIMING = {
  // How long a bot "thinks" before choosing trumps after a Wizard or Jester is
  // turned up, so everyone can see who is choosing. Env BOT_TRUMP_DELAY_MS overrides.
  get botTrumpDelayMs(): number {
    const fromEnvironment = Number(process.env.BOT_TRUMP_DELAY_MS);
    return Number.isFinite(fromEnvironment) && process.env.BOT_TRUMP_DELAY_MS !== undefined ? fromEnvironment : 2500;
  },
  // How long a bot waits on its turn before playing a card, and the same pause
  // before it makes its prediction, in milliseconds.
  // Set BOT_PLAY_DELAY_MS in the environment to override it.
  get botPlayDelayMs(): number {
    const fromEnvironment = Number(process.env.BOT_PLAY_DELAY_MS);
    return Number.isFinite(fromEnvironment) ? fromEnvironment : 4000;
  },

  // How long a completed trick stays as it is before the server clears it and
  // moves the winner into the lead. The table is playing its own gather and
  // tesseract through this, so the two are timed against each other.
  trickHoldMs: 2500,

  // After any move is broadcast, before the runner looks at the game again: a
  // beat for the table to show what just happened rather than the next move
  // landing on top of it.
  afterMoveMs: 700,

  // Once the game is finished, before the room and the game are cleaned up, so
  // the final state reaches everyone and has a moment to be read.
  finishedHoldMs: 2500,
};
