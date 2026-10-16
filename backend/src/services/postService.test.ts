import { describe, it, expect } from "vitest";

import db from "../db/database.js";

import { POST_MAX_LENGTH, PostError, postService } from "./postService.js";
import { maskProfanity } from "./profanityFilter.js";

function createUser(name: string): number {
  const user = db.prepare(`
    INSERT INTO users (username, password_hash, display_name, email)
    VALUES (?, ?, ?, ?)
  `).run(name, "test", name, `${name}@example.com`);

  return Number(user.lastInsertRowid);
}

describe("maskProfanity", () => {
  it("masks English swear words, keeping the first letter", () => {
    expect(maskProfanity("fuck this")).toBe("f*** this");
    expect(maskProfanity("fuuuuck")).toBe("f***");
    expect(maskProfanity("Sh1t happens")).toBe("S*** happens");
  });

  it("masks German swear words, ß included", () => {
    expect(maskProfanity("so ein Scheiß")).not.toContain("Scheiß");
    expect(maskProfanity("du Arschloch")).toBe("du A********");
  });

  it("leaves ordinary words alone", () => {
    for (const text of ["class assignment", "Scunthorpe", "grapes", "the analyst", "gg wp"]) {
      expect(maskProfanity(text)).toBe(text);
    }
  });
});

describe("postService", () => {
  it("stores a trimmed, masked post and lists it newest first", () => {
    const userId = createUser("post-test-user-1");

    try {
      const first = postService.create(userId, "  hello table  ");
      db.prepare("UPDATE posts SET created_at = datetime('now', '-1 hour') WHERE id = ?")
        .run(first.id);
      const second = postService.create(userId, "what the fuck");

      expect(first.text).toBe("hello table");
      expect(second.text).toBe("what the f***");

      const { posts } = postService.list();
      const mine = posts.filter((post) => post.userId === userId);
      expect(mine.map((post) => post.id)).toEqual([second.id, first.id]);
    } finally {
      db.prepare("DELETE FROM users WHERE id = ?").run(userId);
    }
  });

  it("rejects empty, overlong and too-quick posts", () => {
    const userId = createUser("post-test-user-2");

    try {
      expect(() => postService.create(userId, "   ")).toThrow(PostError);
      expect(() => postService.create(userId, "x".repeat(POST_MAX_LENGTH + 1)))
        .toThrow(PostError);

      postService.create(userId, "first");
      expect(() => postService.create(userId, "second")).toThrow(/wait/);
    } finally {
      db.prepare("DELETE FROM users WHERE id = ?").run(userId);
    }
  });

  it("pages back with beforeId", () => {
    const userId = createUser("post-test-user-3");

    try {
      const ids: number[] = [];
      for (let i = 0; i < 25; i += 1) {
        const id = Number(
          db.prepare("INSERT INTO posts (user_id, text) VALUES (?, ?)")
            .run(userId, `post ${i}`).lastInsertRowid,
        );
        ids.push(id);
      }

      const firstPage = postService.list();
      expect(firstPage.posts).toHaveLength(20);
      expect(firstPage.hasMore).toBe(true);

      const oldestShown = firstPage.posts.at(-1)!.id;
      const secondPage = postService.list(oldestShown);
      expect(secondPage.posts.every((post) => post.id < oldestShown)).toBe(true);
      expect(secondPage.posts.map((post) => post.id)).toContain(ids[0]);
    } finally {
      db.prepare("DELETE FROM users WHERE id = ?").run(userId);
    }
  });

  it("removes a user's posts along with the user", () => {
    const userId = createUser("post-test-user-4");
    const post = postService.create(userId, "bye");

    db.prepare("DELETE FROM users WHERE id = ?").run(userId);

    expect(postService.getAuthorId(post.id)).toBeNull();
  });
});
