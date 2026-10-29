import assert from "node:assert/strict";
import { describe, it } from "vitest";

import {
  QUICK_PLAY_FULL_TABLE,
  QUICK_PLAY_MATCH_KEPT_MS,
  QUICK_PLAY_NPCS_AFTER_MS,
  QUICK_PLAY_ROUNDS_SHARE,
  QUICK_PLAY_STALE_MS,
  QUICK_PLAY_TABLE_AFTER_MS,
  QuickPlayQueue,
  quickPlayRounds,
} from "./quickPlayQueue.js";
import { fullRoundCount } from "../models/rounds.js";

// A queue with players 1..count, all joined at time 0.
const queueWith = (count: number): QuickPlayQueue => {
  const queue = new QuickPlayQueue();

  for (let id = 1; id <= count; id += 1) {
    queue.join(id, `player${id}`, 0);
  }

  return queue;
};

// Their pages ask now and then, so the searches are not dropped as left.
const keepAsking = (queue: QuickPlayQueue, count: number, until: number): void => {
  for (let now = 0; now <= until; now += QUICK_PLAY_STALE_MS / 2) {
    for (let id = 1; id <= count; id += 1) {
      queue.status(id, now);
    }
  }

  for (let id = 1; id <= count; id += 1) {
    queue.status(id, until);
  }
};

const tableSizes = (queue: QuickPlayQueue, now: number) =>
  queue.takeMatches(now).map((match) => [match.players.length, match.botCount]);

describe("Quick Play queue", () => {
  it("starts a full table at once", () => {
    const queue = queueWith(QUICK_PLAY_FULL_TABLE);

    assert.deepEqual(tableSizes(queue, 0), [[QUICK_PLAY_FULL_TABLE, 0]]);
  });

  it("seats the longest waiting first and keeps the rest searching", () => {
    const queue = queueWith(QUICK_PLAY_FULL_TABLE + 1);
    const [match] = queue.takeMatches(0);

    assert.deepEqual(
      match!.players.map((seeker) => seeker.userId),
      [1, 2, 3, 4, 5, 6],
    );
    assert.equal(queue.isSearching(QUICK_PLAY_FULL_TABLE + 1), true);
  });

  for (const size of [5, 4, 3] as const) {
    it(`takes a table of ${size} only after its wait`, () => {
      const queue = queueWith(size);
      const wait = QUICK_PLAY_TABLE_AFTER_MS[size];

      keepAsking(queue, size, wait - 1);
      assert.deepEqual(tableSizes(queue, wait - 1), []);

      keepAsking(queue, size, wait);
      assert.deepEqual(tableSizes(queue, wait), [[size, 0]]);
    });
  }

  it("fills the empty seats with NPCs after their wait", () => {
    const queue = queueWith(2);

    keepAsking(queue, 2, QUICK_PLAY_NPCS_AFTER_MS - 1);
    assert.deepEqual(tableSizes(queue, QUICK_PLAY_NPCS_AFTER_MS - 1), []);

    keepAsking(queue, 2, QUICK_PLAY_NPCS_AFTER_MS);
    assert.deepEqual(tableSizes(queue, QUICK_PLAY_NPCS_AFTER_MS), [
      [2, QUICK_PLAY_FULL_TABLE - 2],
    ]);
  });

  it("fills the table with NPCs for a player searching alone", () => {
    const queue = queueWith(1);

    keepAsking(queue, 1, QUICK_PLAY_NPCS_AFTER_MS);
    assert.deepEqual(tableSizes(queue, QUICK_PLAY_NPCS_AFTER_MS), [
      [1, QUICK_PLAY_FULL_TABLE - 1],
    ]);
  });

  it("goes by the longest wait, so a newcomer can complete a table", () => {
    const queue = queueWith(2);
    const wait = QUICK_PLAY_TABLE_AFTER_MS[3];

    keepAsking(queue, 2, wait);
    queue.join(3, "player3", wait);

    assert.deepEqual(tableSizes(queue, wait), [[3, 0]]);
  });

  it("keeps the first place when the player searches again from another tab", () => {
    const queue = queueWith(1);

    queue.join(1, "player1", 5000);

    assert.deepEqual(queue.status(1, 5000), {
      state: "searching",
      waitedMs: 5000,
      playersFound: 1,
    });
  });

  it("forgets a player who cancels", () => {
    const queue = queueWith(QUICK_PLAY_FULL_TABLE);

    queue.leave(1);

    assert.deepEqual(queue.status(1, 0), { state: "idle" });
    assert.deepEqual(tableSizes(queue, 0), []);
  });

  it("drops a search whose page stopped asking", () => {
    const queue = queueWith(QUICK_PLAY_FULL_TABLE);

    for (let id = 2; id <= QUICK_PLAY_FULL_TABLE; id += 1) {
      queue.status(id, QUICK_PLAY_STALE_MS - 1);
    }

    assert.deepEqual(tableSizes(queue, QUICK_PLAY_STALE_MS), []);
    assert.equal(queue.isSearching(1), false);
  });

  it("tells each player their table once", () => {
    const queue = queueWith(QUICK_PLAY_FULL_TABLE);
    const [match] = queue.takeMatches(0);

    queue.setMatched(match!.players.map((seeker) => seeker.userId), 42, 0);

    assert.deepEqual(queue.status(1, 0), { state: "matched", roomId: 42 });
    assert.deepEqual(queue.status(1, 0), { state: "idle" });
  });

  it("forgets a table no page asked about", () => {
    const queue = queueWith(QUICK_PLAY_FULL_TABLE);
    const [match] = queue.takeMatches(0);

    queue.setMatched(match!.players.map((seeker) => seeker.userId), 42, 0);
    queue.takeMatches(QUICK_PLAY_MATCH_KEPT_MS);

    assert.deepEqual(queue.status(1, QUICK_PLAY_MATCH_KEPT_MS), { state: "idle" });
  });

  it("plays its share of a full game's rounds, rounded up", () => {
    for (const players of [3, 4, 5, 6]) {
      assert.equal(
        quickPlayRounds(players),
        Math.ceil(fullRoundCount(players)! * QUICK_PLAY_ROUNDS_SHARE),
      );
      assert.ok(quickPlayRounds(players) >= 1);
      assert.ok(quickPlayRounds(players) <= fullRoundCount(players)!);
    }
  });
});
