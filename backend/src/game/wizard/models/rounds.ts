// A full game deals one more card each round until the 60-card deck can't go
// round again, so its length depends on the number of players.
const FULL_ROUND_COUNT: Record<number, number> = {
  3: 20,
  4: 15,
  5: 12,
  6: 10,
};

// Rounds in a full game for this many players; undefined outside 3 to 6.
export function fullRoundCount(playerCount: number): number | undefined {
  return FULL_ROUND_COUNT[playerCount];
}
