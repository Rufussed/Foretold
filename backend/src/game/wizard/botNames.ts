import type { AvatarId } from "./models/avatar.js";
import { BOT_NAME_SUFFIX } from "./models/bot.js";

// Names given to bots, each shown with " NPC" after it ("Merlin NPC"). A bot's
// name suits its avatar: male names for the male avatars, female names for the
// rest. Edit freely; a game draws at random from names not already taken.
export const BOT_NAMES = {
  male: [
    // Legend and myth
    "Merlin",
    "Arthur",
    "Lancelot",
    "Taliesin",
    "Gwydion",
    "Oberon",
    "Prospero",
    // Fantasy
    "Thorne",
    "Alaric",
    "Corvin",
    "Balthazar",
    "Fenwick",
    // History
    "Nostradamus",
    "John Dee",
    "Paracelsus",
    "Rasputin",
    "Agrippa",
  ],
  female: [
    // Legend and myth
    "Morgana",
    "Nimue",
    "Guinevere",
    "Circe",
    "Medea",
    "Vivienne",
    "Rhiannon",
    "Titania",
    "Baba Yaga",
    // Fantasy
    "Esmeralda",
    "Isolde",
    "Elowen",
    "Seraphina",
    "Lyra",
    "Ysolde",
    "Mirabel",
    // History
    "Cleopatra",
    "Boudica",
    "Hypatia",
    "Hildegard",
    "Joan",
  ],
} as const;

// Which name list each avatar draws from.
export const AVATAR_NAME_LIST: Record<AvatarId, keyof typeof BOT_NAMES> = {
  goatman: "male",
  demon: "male",
  "blind-wizard": "male",
  "forest-elf": "female",
  "black-witch": "female",
  "kungfu-girl": "female",
};

// If a list runs out, extras are numbered: "Wizard 1 NPC" or "Witch 1 NPC".
const FALLBACK_NAME = { male: "Wizard", female: "Witch" } as const;

// One name per bot avatar, in the same order, "<name> NPC": drawn at random
// from that avatar's list, and never a name already taken or picked.
export function pickBotNames(
  avatars: readonly AvatarId[],
  taken: readonly string[],
  random: () => number = Math.random,
): string[] {
  const used = new Set(taken);
  const shuffled = (names: readonly string[]) => {
    const copy = [...names];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j]!, copy[i]!];
    }
    return copy;
  };
  const pools = { male: shuffled(BOT_NAMES.male), female: shuffled(BOT_NAMES.female) };

  return avatars.map((avatar) => {
    const list = AVATAR_NAME_LIST[avatar];
    let name: string | undefined;
    while (!name && pools[list].length) {
      const candidate = `${pools[list].shift()}${BOT_NAME_SUFFIX}`;
      if (!used.has(candidate)) name = candidate;
    }
    for (let extra = 1; !name; extra++) {
      const candidate = `${FALLBACK_NAME[list]} ${extra}${BOT_NAME_SUFFIX}`;
      if (!used.has(candidate)) name = candidate;
    }
    used.add(name);
    return name;
  });
}
