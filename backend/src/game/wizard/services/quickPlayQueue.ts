// Quick Play: a logged-in player asks for a Classic game and the server seats
// them. The queue lives in memory, so a restart empties it; the players'
// pages then simply search again.

import { fullRoundCount } from "../models/rounds.js";

// How often the server tries to form tables.
export const QUICK_PLAY_TICK_MS = 1000;

// The table it aims for; smaller ones are taken only after a wait.
export const QUICK_PLAY_FULL_TABLE = 6;

// How long the longest-waiting player has waited before a smaller table will
// do. A full table starts at once.
export const QUICK_PLAY_TABLE_AFTER_MS: Record<3 | 4 | 5, number> = {
  5: 15_000,
  4: 20_000,
  3: 30_000,
};

// After this wait NPCs fill the empty seats up to a full table, even for a
// player searching alone.
export const QUICK_PLAY_NPCS_AFTER_MS = 50_000;

// Quick Play games are shorter and quicker than a full one: this share of a
// full game's rounds (rounded up), at this pace (2 is "Fast" in room setup).
export const QUICK_PLAY_ROUNDS_SHARE = 0.5;
export const QUICK_PLAY_PACE = 2;

export function quickPlayRounds(playerCount: number): number {
  return Math.ceil((fullRoundCount(playerCount) ?? 0) * QUICK_PLAY_ROUNDS_SHARE);
}

// A search whose page has not asked about it for this long was left (the tab
// closed), and is dropped.
export const QUICK_PLAY_STALE_MS = 10_000;

// A found game waits this long for the page to ask about it.
export const QUICK_PLAY_MATCH_KEPT_MS = 60_000;

export interface QuickPlaySeeker {
  userId: number;
  username: string;
  joinedAt: number;
  lastSeenAt: number;
}

export interface QuickPlayMatch {
  players: QuickPlaySeeker[];
  botCount: number;
}

export type QuickPlayStatus =
  | { state: "idle" }
  | { state: "searching"; waitedMs: number; playersFound: number }
  | { state: "matched"; roomId: number };

// The smallest table the longest wait allows.
function smallestTable(waitedMs: number): number {
  for (const size of [3, 4, 5] as const) {
    if (waitedMs >= QUICK_PLAY_TABLE_AFTER_MS[size]) {
      return size;
    }
  }

  return QUICK_PLAY_FULL_TABLE;
}

export class QuickPlayQueue {
  // In joining order.
  private seekers: QuickPlaySeeker[] = [];
  private matched = new Map<number, { roomId: number; at: number }>();

  // Searching again from a second tab keeps the place in the queue.
  join(userId: number, username: string, now: number): void {
    this.matched.delete(userId);

    const seeker = this.seekers.find((entry) => entry.userId === userId);

    if (seeker) {
      seeker.lastSeenAt = now;
      return;
    }

    this.seekers.push({ userId, username, joinedAt: now, lastSeenAt: now });
  }

  leave(userId: number): void {
    this.seekers = this.seekers.filter((entry) => entry.userId !== userId);
  }

  isSearching(userId: number): boolean {
    return this.seekers.some((entry) => entry.userId === userId);
  }

  // Asking counts as still being there. A found game is told once, so a
  // later visit to the Glade does not send the player to it again.
  status(userId: number, now: number): QuickPlayStatus {
    const match = this.matched.get(userId);

    if (match) {
      this.matched.delete(userId);
      return { state: "matched", roomId: match.roomId };
    }

    const seeker = this.seekers.find((entry) => entry.userId === userId);

    if (!seeker) {
      return { state: "idle" };
    }

    seeker.lastSeenAt = now;

    return {
      state: "searching",
      waitedMs: now - seeker.joinedAt,
      playersFound: this.seekers.length,
    };
  }

  // The tables that can start now, longest waiting first; their players
  // leave the queue. Drops the searches that were left first.
  takeMatches(now: number): QuickPlayMatch[] {
    this.seekers = this.seekers.filter(
      (entry) => now - entry.lastSeenAt < QUICK_PLAY_STALE_MS,
    );

    for (const [userId, match] of this.matched) {
      if (now - match.at >= QUICK_PLAY_MATCH_KEPT_MS) {
        this.matched.delete(userId);
      }
    }

    const matches: QuickPlayMatch[] = [];

    while (this.seekers.length > 0) {
      const waitedMs = now - this.seekers[0]!.joinedAt;
      const count = Math.min(this.seekers.length, QUICK_PLAY_FULL_TABLE);

      if (count >= smallestTable(waitedMs)) {
        matches.push({ players: this.seekers.splice(0, count), botCount: 0 });
        continue;
      }

      if (waitedMs >= QUICK_PLAY_NPCS_AFTER_MS) {
        matches.push({
          players: this.seekers.splice(0, count),
          botCount: QUICK_PLAY_FULL_TABLE - count,
        });
        continue;
      }

      break;
    }

    return matches;
  }

  // Where each player of a started table is to go.
  setMatched(userIds: number[], roomId: number, now: number): void {
    for (const userId of userIds) {
      this.matched.set(userId, { roomId, at: now });
    }
  }
}

export const quickPlayQueue = new QuickPlayQueue();
