import db from "../db/database.js";
import { maskProfanity } from "./profanityFilter.js";

export const POST_MAX_LENGTH = 500;
export const POST_PAGE_SIZE = 20;
// One post per player in this many seconds, so nobody can flood the board.
export const POST_COOLDOWN_SECONDS = 30;

export interface Post {
  id: number;
  userId: number;
  username: string;
  displayName: string;
  text: string;
  createdAt: string;
}

interface PostRow {
  id: number;
  user_id: number;
  username: string;
  display_name: string;
  text: string;
  created_at: string;
}

export class PostError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
  }
}

const toPost = (row: PostRow): Post => ({
  id: row.id,
  userId: row.user_id,
  username: row.username,
  displayName: row.display_name,
  text: row.text,
  createdAt: row.created_at,
});

export const postService = {
  // Newest first. `beforeId` pages back: the next page starts below the
  // oldest post already shown.
  list(beforeId?: number): { posts: Post[]; hasMore: boolean } {
    const rows = db
      .prepare(`
        SELECT posts.id, posts.user_id, users.username, users.display_name,
          posts.text, posts.created_at
        FROM posts
          JOIN users ON users.id = posts.user_id
        WHERE (? IS NULL OR posts.id < ?)
        ORDER BY posts.id DESC
        LIMIT ?
      `)
      .all(beforeId ?? null, beforeId ?? null, POST_PAGE_SIZE + 1) as PostRow[];

    return {
      posts: rows.slice(0, POST_PAGE_SIZE).map(toPost),
      hasMore: rows.length > POST_PAGE_SIZE,
    };
  },

  create(userId: number, rawText: string): Post {
    const text = rawText.trim();

    if (!text) {
      throw new PostError("Write something first", 400);
    }

    if (text.length > POST_MAX_LENGTH) {
      throw new PostError(`Posts can be at most ${POST_MAX_LENGTH} characters`, 400);
    }

    const recent = db
      .prepare(`
        SELECT 1
        FROM posts
        WHERE user_id = ?
          AND created_at > datetime('now', ?)
        LIMIT 1
      `)
      .get(userId, `-${POST_COOLDOWN_SECONDS} seconds`);

    if (recent) {
      throw new PostError(
        `Please wait ${POST_COOLDOWN_SECONDS} seconds between posts`,
        429,
      );
    }

    const result = db
      .prepare("INSERT INTO posts (user_id, text) VALUES (?, ?)")
      .run(userId, maskProfanity(text));

    const row = db
      .prepare(`
        SELECT posts.id, posts.user_id, users.username, users.display_name,
          posts.text, posts.created_at
        FROM posts
          JOIN users ON users.id = posts.user_id
        WHERE posts.id = ?
      `)
      .get(Number(result.lastInsertRowid)) as PostRow;

    return toPost(row);
  },

  // Guests play one table and are cleared away afterwards; posting is for
  // accounts only.
  isGuest(userId: number): boolean {
    const row = db
      .prepare("SELECT is_guest FROM users WHERE id = ?")
      .get(userId) as { is_guest: number } | undefined;

    return row?.is_guest === 1;
  },

  getAuthorId(postId: number): number | null {
    const row = db
      .prepare("SELECT user_id FROM posts WHERE id = ?")
      .get(postId) as { user_id: number } | undefined;

    return row?.user_id ?? null;
  },

  delete(postId: number): void {
    db.prepare("DELETE FROM posts WHERE id = ?").run(postId);
  },
};
