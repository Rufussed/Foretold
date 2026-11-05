# Roleplay cards — general prompt

Status: current working baseline, updated 4 November 2026. This is the master
rendering, motif and layout prompt for Roleplay and the Foretold v2 remakes.
Water Thief is the explicitly selected style anchor. All 60 Foretold v2 cards
are complete in ../foretoldv2/ and awaiting user review; original root artwork
and runtime assets remain unchanged. See HANDOFF.md for current deliverables.
The local card-hierarchy.md is historical: active ranks 1–13 are Peasant, Farmer,
Citizen, Soldier, Merchant, Priest, General, Thief, Trickster, Seer, Heir, Consort,
Monarch. Wizard and Fool are elementless. Roleplay professions receive no rank
unless specified by the user.

## Reusable generation prompt

Create full-bleed portrait fantasy playing-card artwork, approximately 5:7.
Character brief: [RANK, ELEMENT, IDENTITY, EMOTION, ACTION, COSTUME, KEY OBJECT,
AND SETTING].

Use traditional tarot-inspired ink drawing with hand-painted colour. Match the
balance of drawing, colour and simplification in water-thief.png:
strong, confident, slightly irregular dark contours, broad clear colour masses,
simple expressive features and restrained painted depth. The drawing should
remain clear before surface texture is noticed. Preserve warmth, personality
and theatrical storytelling, with coherent natural anatomy.

Use a deliberate palette tied to the element. Organise each major surface
primarily as one base colour plus one or two large shadow shapes. Leave generous
areas relatively unshaded. Use only a little gentle painted variation to soften
selected transitions. Avoid numerous intermediate tones, small tonal facets,
reflected-light accents and tiny highlights. Faces and hands need economical
ink drawing and a few broad shadows rather than realistic anatomical modelling.
Keep depth without turning every surface into either a gradient or a flat fill.

Make outer contours visibly strong and confident, with lighter, economical
internal lines. Describe clothing through a few broad folds, hair through
grouped locks and faces through a few distinctive expressive features. Indicate
age, scars and rough character with selected clear marks rather than dense
wrinkles, stubble dots, cheek hatching or skin texture. Beauty and ruggedness
should come from individual shapes and proportions, not extra rendering.

Reduce fine detail across the whole illustration, including secondary objects
and scenery. Group foliage, rocks, architecture and water into larger painted
shapes. Use calm water with sparse low-contrast ripples and no white reflection
streaks or sparkles. Use sparse material marks and simple landscape masses. Preserve subtle hand-painted variation but avoid all-over speckling,
scratches, mottled grain, detailed wood grain and fabric texture. Keep rich,
clear colour rather than a sepia wash. No scan dots or distressed print effect.

Keep enemy objects and targets neutral when faction is unspecified: natural
wood, stone or plain canvas, without automatically colouring them as the
character's suit. The character and environment carry the elemental palette.

One dominant character with a particular personality and one unmistakable
emotion, expressed through face, posture and hands. Give them one clear action
and a small number of meaningful objects. Simplification must preserve the
expression and gesture. Costume and equipment should communicate rank, story
and wartime standing. Maintain physically coherent hands, weapons and mounts.

Keep the setting recognisable and atmospheric but simplify its detail: larger
landscape or architectural masses, gentle depth and calmer areas of sky or ground.
Avoid describing every leaf, stone, roof tile or wave. Magical effects, if
needed, should use a few coherent painted shapes with restrained light and texture.
The face, action and key object must read at thumbnail size. The elemental
motif should remain recognisable on closer inspection without competing with them.

Use the exact suit motif from references/elemental-symbols.png as a subtle
part of the character's world. Preserve its four-part structure and orientation,
but keep it secondary to the face and action. It may reward a closer look rather
than announce itself at thumbnail size. Use a small tattoo, restrained woven or
embroidered clothing pattern, or an engraving on a weapon, tool or personal
object. Never copy a conspicuous motif patch from an older character reference. Replace
it with a discreet integrated treatment. Choose one natural placement appropriate
to the character. Use modest scale and related colours or material tones, with enough definition to recognise
the motif on inspection. Avoid prominent chest badges, large pendants, bright
contrasting patches and oversized emblems presented toward the viewer. Establish
the suit primarily through the overall palette and environment.
Suit motifs and colour families:

Keep skies consistent within each element across ranks. Use existing roleplay
cards as palette anchors, allowing closely related gradients and weather:
Water clear cobalt/azure blue, Fire ember/crimson red-orange, Earth muted pale
sage/green, Air cream #E2C98A. Carry that light coherently into clouds, mountains,
stone and cast shadows. Preserve character/material colours rather than adding
a uniform coloured wash. The latest Air Thief/Warrior/Fisher warm-light versions
were explicitly approved by the user on 3 November 2026.

- Air: four straight horizontal bars; white, ivory, silver and slate. Sky is
  cream RGB 226,201,138 (#E2C98A), allowing close gradients (updated 3 November).
  Mountains under that light use muted warm stone greys, taupe and restrained
  ochre, ivory snow and low-saturation shadows; avoid strongly blue mountains.
  Match stonework too: cream sunlit stone, warm neutral grey/taupe shadows
  with clear depth and cast direction, avoiding cold blue masonry shadows.
- Fire: four vertical wavy strokes; red, ember, orange and gold.
- Water: four horizontal waves; blue, cyan and deep sea tones.
- Earth: four stacked angular zigzag bands; rich forest and emerald greens,
  with restrained moss, ochre and soil accents.

Fool and Wizard remain elementless. Preserve their original palette and story
when remaking them; remove conspicuous suit emblems rather than imposing a suit
identity. Element-prefixed filenames for these cards identify deck slots only.

Keep the upper-right label area quiet: the rightmost 22% of the image within
the upper 25% should contain simple background, without faces, objects, strong
contours or busy texture. Do not draw a clearance box. No baked-in text,
letters, numbers, titles, borders, frames or watermark.

Each character must differ clearly from the other suits of the same rank in
identity, silhouette, costume, pose, prop and location. Use
water-thief.png as the main reference for rendering only:
outline strength, broad shading, colour grouping and detail level. Do not copy
its pirate identity, smile, cheek scar, facial marks, costume, pose, knife, rope, palette or harbour into
unrelated cards. Earlier Fortold images can guide character continuity but must
not pull the rendering back toward intricate realistic fantasy painting.
Scars belong only to individually specified characters. Do not copy the Water
Thief's pale crossed cheek scar into new cards; do not add scars by default.
For Warriors, create fierce independent combat poses; do not copy Soldier poses.
Rider–Waite remains a supporting reference for drawing economy rather than
an exact target for flatness, heavy outlines, patterns or print texture.

Avoid realistic fantasy painting, anatomical over-modelling, intricate surface
detail, numerous small shadows, dense crosshatching, individual hair strands,
busy fabric folds, photographic skin, polished 3D and anime styling. Retain
selective painterly depth and expressive character; avoid fully flat vector
colour, heavy uniform cartoon outlines or a wholesale woodcut treatment.

## Applying this prompt to new cards

Pair the reusable prompt with a short individual brief specifying identity,
dominant emotion, one action, silhouette, costume, key object, subtle motif
placement and a simple elemental setting. Do not add long inventories of
surface details. Describe hands and object connections concretely where they
matter: a continuous weapon and grip, a natural wrist, visible attachment points
and an uncomplicated path for any rope or strap. Let the pose change when
necessary to keep anatomy and the action readable.

For image references, label the latest Water Thief as STYLE ONLY. A new card
can also be generated without image references using the same written rules.
Check the first result for drift toward realistic shading; if necessary request
stronger ink contours, broader shadow shapes and fewer surface marks while
preserving the character. Check hands, object connections and the four-part
motif separately before accepting an illustration.

## Remaking an existing card

Use the original image for character identity, age/species, expression, pose,
costume cut, main props and composition. Apply this guide to rendering and
lighting, with minor natural anatomy or object corrections where necessary.
Simplify shading, gradients and fine marks while retaining expressive depth.
Remove conspicuous old badges and replace with one small tonal integrated motif.
Do not carry the style anchor's personal features into the character.

If the user asks for a fresh sight-unseen design, do not inspect or reference
that character's old artwork or old prompts. For the completed Foretold v2
batch this exception applied specifically to Earth and Fire Tricksters: Fire
less demonic, Earth more sinister and less pretty without being grotesque.
Those are individual briefs, not a change to every Fire/Earth character.

## Reference priorities

1. water-thief.png: selected rendering anchor; use as STYLE ONLY for new people.
2. The individual character brief and, if supplied, original character image:
   identity, pose and story only. Simplify its finish to match the roleplay style.
3. references/elemental-symbols.png: authoritative motif geometry.

Optional historical inspiration: Rider–Waite King of Wands and Knight of Swords,
for ink drawing and colour grouping. Their dense ornament, print dots, borders,
labels and fully flat rendering are not requirements. These external references
are not needed to continue with this folder.
