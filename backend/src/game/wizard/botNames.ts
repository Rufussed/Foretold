import { BOT_NAME_SUFFIX } from "./models/bot.js";

// Names given to bots, each shown with " NPC" after it ("Merlin NPC"). Edit
// freely: a game draws at random from whichever aren't already at the table.
export const BOT_NAMES: readonly string[] = [
  // Legend and myth
  "Merlin",
  "Morgana",
  "Nimue",
  "Arthur",
  "Guinevere",
  "Lancelot",
  "Circe",
  "Medea",
  "Taliesin",
  "Vivienne",
  "Gwydion",
  "Rhiannon",
  "Oberon",
  "Titania",
  "Baba Yaga",
  "Prospero",
  // Fantasy
  "Esmeralda",
  "Isolde",
  "Thorne",
  "Elowen",
  "Alaric",
  "Seraphina",
  "Corvin",
  "Lyra",
  "Balthazar",
  "Ysolde",
  "Fenwick",
  "Mirabel",
  // History
  "Cleopatra",
  "Boudica",
  "Hypatia",
  "Nostradamus",
  "John Dee",
  "Paracelsus",
  "Hildegard",
  "Joan",
  "Rasputin",
  "Agrippa",
];

// Picks count bot names, "<name> NPC", at random and none already taken.
export function pickBotNames(
  count: number,
  taken: readonly string[],
  random: () => number = Math.random,
): string[] {
  const available = BOT_NAMES.map((name) => `${name}${BOT_NAME_SUFFIX}`).filter(
    (name) => !taken.includes(name),
  );
  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [available[i], available[j]] = [available[j]!, available[i]!];
  }
  const picked = available.slice(0, count);
  // More bots than names: number the extras rather than fail.
  for (let extra = 1; picked.length < count; extra++) {
    const name = `Wizard ${extra}${BOT_NAME_SUFFIX}`;
    if (!taken.includes(name) && !picked.includes(name)) picked.push(name);
  }
  return picked;
}
