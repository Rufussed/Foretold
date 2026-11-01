import { describe, expect, it } from "vitest";
import type { GamePlayer, PlayedCard, WizardGameState } from "../../../models/wizardGame.js";
import { countJokerTrick, JOKER_MAX, JOKER_TRICKS, playsFree, spendJokerPoint } from "./joker.js";
import { play } from "../roleTestHelpers.js";

const joker = (extra: Partial<GamePlayer> = {}): GamePlayer =>
  ({ username: "jo", role: "joker", hand: [], roundScores: [], ...extra }) as unknown as GamePlayer;

const trick = (playedCards: PlayedCard[] = [play("ben", 8), play("jo", 9)], players: GamePlayer[] = []): WizardGameState =>
  ({ players, currentTrick: { playedCards, winnerUsername: null } }) as unknown as WizardGameState;

const winTricks = (player: GamePlayer, count: number, playedCards?: PlayedCard[]) => {
  const game = trick(playedCards, [player]);
  for (let i = 0; i < count; i += 1) countJokerTrick(game, player);
};

const ben = { username: "ben", hand: [], roundScores: [] } as unknown as GamePlayer;

describe("playsFree", () => {
  it("needs a point", () => {
    expect(playsFree(joker())).toBe(false);
    expect(playsFree(joker({ jokerPoints: 1 }))).toBe(true);
  });

  it("is for the Joker only", () => {
    expect(playsFree(joker({ role: "thief", jokerPoints: 2 }))).toBe(false);
  });
});

describe("countJokerTrick", () => {
  it("gives a point every JOKER_TRICKS tricks, and counts on from 0", () => {
    const jo = joker();
    winTricks(jo, JOKER_TRICKS - 1);
    expect(jo).toMatchObject({ jokerTricks: JOKER_TRICKS - 1 });
    expect(jo.jokerPoints ?? 0).toBe(0);
    winTricks(jo, 1);
    expect(jo).toMatchObject({ jokerPoints: 1, jokerTricks: 0 });
  });

  it("stops at JOKER_MAX, and tricks won meanwhile do not count", () => {
    const jo = joker({ jokerPoints: JOKER_MAX - 1 });
    winTricks(jo, JOKER_TRICKS + 2);
    expect(jo).toMatchObject({ jokerPoints: JOKER_MAX, jokerTricks: 0 });
  });

  it("does not count the trick a point was spent in", () => {
    const jo = joker({ jokerPoints: 1, jokerTricks: 2 });
    const breaking = { ...play("jo", 3, "Blue"), freePlay: true as const };
    spendJokerPoint(jo);
    winTricks(jo, 1, [play("ben", 8), breaking]);
    expect(jo).toMatchObject({ jokerPoints: 0, jokerTricks: 2 });
  });

  it("counts a Jester played as a trick won, whoever wins", () => {
    const jo = joker();
    countJokerTrick(trick([play("ben", 8), play("jo", 0)], [jo, ben]), ben);
    expect(jo.jokerTricks).toBe(1);
  });

  it("counts a Jester that wins the trick twice", () => {
    const jo = joker({ jokerTricks: 1 });
    countJokerTrick(trick([play("jo", 0), play("ben", 0)], [jo, ben]), jo);
    expect(jo).toMatchObject({ jokerPoints: 1, jokerTricks: 0 });
  });

  it("counts no Jester once full", () => {
    const jo = joker({ jokerPoints: JOKER_MAX });
    countJokerTrick(trick([play("ben", 8), play("jo", 0)], [jo, ben]), ben);
    expect(jo.jokerTricks).toBeUndefined();
  });

  it("counts nothing for other roles", () => {
    const thief = joker({ role: "thief" });
    winTricks(thief, JOKER_TRICKS);
    expect(thief.jokerPoints).toBeUndefined();
  });
});
