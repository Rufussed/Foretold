// The ways to play on the platform. Classic is Wizard as printed and the
// baseline every other mode builds on; each other mode keeps its own rules in
// its own folder beside this file. Like gameOptions.ts it must stay free of
// Node-only code, because Vite bundles it into the browser.

export const GAME_MODES = ["classic", "roles"] as const;

export type GameMode = (typeof GAME_MODES)[number];

export const isGameMode = (value: unknown): value is GameMode =>
  GAME_MODES.some((mode) => mode === value);
