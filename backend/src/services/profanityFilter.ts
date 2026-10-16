import {
  DataSet,
  RegExpMatcher,
  TextCensor,
  asteriskCensorStrategy,
  englishDataset,
  englishRecommendedTransformers,
  keepStartCensorStrategy,
  pattern,
} from "obscenity";

// English comes from obscenity's own list, which already sees through
// "fuuuck", "sh1t" and look-alike letters without catching "Scunthorpe" or
// "grapes". German is our own short list on top: add a word with a phrase of
// its own. "|...|" in a pattern means the whole word only, for words that
// also sit inside harmless ones.
const dataset = new DataSet<{ originalWord: string }>()
  .addAll(englishDataset)
  .addPhrase((phrase) =>
    phrase.setMetadata({ originalWord: "scheisse" }).addPattern(pattern`scheis`),
  )
  .addPhrase((phrase) =>
    phrase.setMetadata({ originalWord: "arschloch" }).addPattern(pattern`arschloch`),
  )
  .addPhrase((phrase) =>
    phrase.setMetadata({ originalWord: "hurensohn" }).addPattern(pattern`hurensohn`),
  )
  .addPhrase((phrase) =>
    phrase.setMetadata({ originalWord: "hure" }).addPattern(pattern`|hure|`),
  )
  .addPhrase((phrase) =>
    phrase.setMetadata({ originalWord: "wichser" }).addPattern(pattern`wichser`),
  )
  .addPhrase((phrase) =>
    phrase.setMetadata({ originalWord: "fotze" }).addPattern(pattern`fotze`),
  )
  .addPhrase((phrase) =>
    phrase.setMetadata({ originalWord: "schlampe" }).addPattern(pattern`schlampe`),
  )
  .addPhrase((phrase) =>
    phrase.setMetadata({ originalWord: "missgeburt" }).addPattern(pattern`missgeburt`),
  )
  .addPhrase((phrase) =>
    phrase.setMetadata({ originalWord: "ficken" }).addPattern(pattern`fick`),
  );

const matcher = new RegExpMatcher({
  ...dataset.build(),
  ...englishRecommendedTransformers,
});

// Keeps the first letter so the sentence still reads: "f*** this".
const censor = new TextCensor().setStrategy(
  keepStartCensorStrategy(asteriskCensorStrategy()),
);

// The matcher drops letters outside plain ASCII, so "Scheiß" would slip
// through. ß and s are one character each, so the positions it finds in the
// copy are the same in the original, which is what gets masked.
export function containsProfanity(text: string): boolean {
  return matcher.hasMatch(text.replace(/ß/g, "s"));
}

export function maskProfanity(text: string): string {
  const matches = matcher.getAllMatches(text.replace(/ß/g, "s"));
  return matches.length ? censor.applyTo(text, matches) : text;
}
