// Tweakable gameplay rules. Read by the server (enforcing them, and by the
// NPCs) and by the visualiser (which buttons it offers), so both agree.
export const GAMEPLAY_RULES = {
  // The last player to predict in a round may not choose the number that makes
  // everyone's predictions add up to the tricks in that round, so at least one
  // player must miss. false lets them choose anything.
  lastPredictionCannotMatchTricks: true,

  // The Seer and the Trickster (ranks 10 and 9) are ordinary cards with a power
  // for whoever wins a trick with one: the Seer moves the winner's own
  // prediction, the Trickster an opponent's, by one either way. false makes
  // them plain cards.
  cardPowersEnabled: true,

  // When an NPC would choose that forbidden number, how often it goes one lower
  // instead (the rest of the time it goes one higher). Where only one of those
  // is possible (0 has no lower, the round's tricks no higher), it takes that.
  npcForbiddenGoesLowerChance: 0.75,
};
