// The gestures a player can play on their character. Kept here, beside the
// other game models, so the server can check an incoming emote against the
// same list the visualiser animates from.

export const EMOTE_NAMES = ["laugh", "disbelief", "disapproval", "thumbsUp"] as const;

export type Emote = (typeof EMOTE_NAMES)[number];

export function isEmote(value: unknown): value is Emote {
	return typeof value === "string" && (EMOTE_NAMES as readonly string[]).includes(value);
}
