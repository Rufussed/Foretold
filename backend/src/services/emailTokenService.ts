import { createHash, randomBytes } from "node:crypto";
import db from "../db/database.js";

// The secrets in the links mailed to players (table email_tokens). Confirming
// an address and setting a new password work the same way and differ only in
// purpose and in how long a link lasts.
export type EmailTokenPurpose = "verify" | "reset";

const LIFETIME_MINUTES: Record<EmailTokenPurpose, number> = {
  verify: 24 * 60,
  reset: 60,
};

const hashOf = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

export const emailTokenService = {
  // A new link for the player. Their older links for the same purpose stop
  // working, so only the latest mail counts.
  create(userId: number, purpose: EmailTokenPurpose): string {
    const token = randomBytes(32).toString("base64url");

    db.prepare("DELETE FROM email_tokens WHERE user_id = ? AND purpose = ?").run(
      userId,
      purpose,
    );
    db.prepare(`
      INSERT INTO email_tokens (user_id, purpose, token_hash, expires_at)
      VALUES (?, ?, ?, datetime('now', ?))
    `).run(userId, purpose, hashOf(token), `+${LIFETIME_MINUTES[purpose]} minutes`);

    return token;
  },

  // The player a link belongs to, or null when it is unknown, expired or for
  // the other purpose. A link works once: it is deleted here.
  consume(token: string, purpose: EmailTokenPurpose): number | null {
    const row = db
      .prepare(`
        SELECT id, user_id AS userId
        FROM email_tokens
        WHERE token_hash = ? AND purpose = ? AND expires_at > datetime('now')
      `)
      .get(hashOf(token), purpose) as { id: number; userId: number } | undefined;

    if (!row) return null;

    db.prepare("DELETE FROM email_tokens WHERE id = ?").run(row.id);
    return row.userId;
  },

  // Seconds since the player's latest link for this purpose was made, or null
  // if there is none. Keeps one person from filling an inbox.
  secondsSinceLast(userId: number, purpose: EmailTokenPurpose): number | null {
    const row = db
      .prepare(`
        SELECT CAST(strftime('%s', 'now') - strftime('%s', MAX(created_at)) AS INTEGER) AS seconds
        FROM email_tokens
        WHERE user_id = ? AND purpose = ?
      `)
      .get(userId, purpose) as { seconds: number | null } | undefined;

    return row?.seconds ?? null;
  },
};
