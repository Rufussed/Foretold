// The six playable characters, in the order unclaimed avatars are handed out.
// The frontend imports this list as well, so every id must match a character
// GLB in public/models/wizard/.
export const AVATAR_IDS = [
  "forest-elf",
  "blind-wizard",
  "black-witch",
  "kungfu-girl",
  "goatman",
  "demon",
] as const;

export type AvatarId = (typeof AVATAR_IDS)[number];

export function isAvatarId(value: unknown): value is AvatarId {
  return (
    typeof value === "string" &&
    (AVATAR_IDS as readonly string[]).includes(value)
  );
}
