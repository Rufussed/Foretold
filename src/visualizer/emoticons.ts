// The drawn emoticons (src/assets/emoticons), in place of the system emoji
// font, which looks different on every device: one for each emote button, and
// the crown. Vite hashes each file's name into the build, so the URLs come from
// this table rather than being written out.
const FILES = import.meta.glob("../assets/emoticons/*.webp", {
  query: "?url",
  import: "default",
  eager: true,
}) as Record<string, string>;

export type Emoticon = "crown" | "laugh" | "disbelief" | "thumbsDown" | "thumbsUp";

export function emoticonUrl(name: Emoticon): string {
  const url = FILES[`../assets/emoticons/${name}.webp`];
  if (!url) throw new Error(`No emoticon art at src/assets/emoticons/${name}.webp`);
  return url;
}
