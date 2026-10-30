// Tweakable gameplay rules. Read by the server (enforcing them, and by the
// NPCs) and by the visualiser (which buttons it offers), so both agree.
export const GAMEPLAY_RULES = {
  // When the last predictor may not make everyone's predictions add up to the
  // round's tricks (the room's lastPredictionLimited, gameOptions.ts) and an
  // NPC would choose that forbidden number, how often it goes one lower
  // instead (the rest of the time it goes one higher). Where only one of those
  // is possible (0 has no lower, the round's tricks no higher), it takes that.
  npcForbiddenGoesLowerChance: 0.75,
};
