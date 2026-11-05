# Fortold roleplay cards — session handoff

Updated: 4 November 2026. This document is the continuation memory for a new
Codex or ChatGPT session. It does not require access to the previous chat.

## Start here

Read general-prompt.md, then the relevant individual *-prompt.txt. Inspect
water-thief.png before generating: it is the user's selected style anchor.
Use references/elemental-symbols.png for exact symbol geometry. The local
card-hierarchy.md is historical and has stale rank names/order; see the current
deck mapping below. Roleplay professions have no assigned rank unless specified.

Suggested opening message for a new chat:

> Continue my Fortold roleplay card project. Read HANDOFF.md and general-prompt.md
> in the attached roleplay folder and inspect water-thief.png. Use that rendering
> style for the next cards. Keep elemental motifs subtle. Ask which card to make
> next if I have not specified it; do not regenerate completed cards automatically.

For ChatGPT on another computer, attach these documents and the selected Water
Thief image (and the relevant character image). Local file paths from the old
computer will not supply the actual files to a new chat.

## Latest completed work — Foretold v2

All 60 active-deck card remakes are complete in ../foretoldv2/ and awaiting user
review. Start with [the review gallery](../foretoldv2/index.html) or its four
contact sheets in ../foretoldv2/review/. The user authorised the whole batch
without intermediate review stops; it has finished. Do not rerun it automatically.

The root original artworks and runtime game assets remain unchanged. The new
images preserve root identities, poses, costume silhouettes, main props and
compositions, with Roleplay-style broad shading, simpler gradients/scenery,
subtler motifs and coherent elemental sky/light. Normal generation variation
remains. Only Earth and Fire Tricksters were fresh sight-unseen designs: no old
Trickster artwork or prompts were consulted. Fire is a human-looking lantern
and shadow-puppet deceiver rather than demonic; Earth is a sinister green elf
at a crossroads, less pretty without being grotesque.

Current active ranks 1–13: Peasant, Farmer, Citizen, Soldier, Merchant, Priest,
General, Thief, Trickster, Seer, Heir, Consort, Monarch. There are four Wizard
slots and four Fool slots, both elementless: 52 + 4 + 4 = 60. Element prefixes
on Wizard/Fool filenames identify deck slots, not suit membership. One root
Fool source supplies four distinct slot renderings. Historical Noble/knight/
sorceress studies are not additional slots. Active game mapping is in
../../src/i18n/en.ts and ../../backend/src/game/wizard/models/card.ts.

../foretoldv2/manifest.json records sources, all 60 completion statuses,
1060×1484 dimensions and checksums. Every output has exact prompt history in
prompts/ and visual review notes in qa/. All 60 images decode, are distinct,
and have those records; gallery links were checked. Suited motifs were visually
audited and corrected to four strokes where needed. Small remaining limitations
are documented individually: notably Air Seer's source birds remain near the
upper-right label area. Fire/Earth review notes add detailed observations.
Completion and internal QA do not imply user approval.

The master general-prompt.md remains the reusable source for future cards;
../foretoldv2/STYLE-GUIDE.md is its synced copy. Exact historical generation
prompts in foretoldv2/prompts/ remain unchanged by documentation updates.

## Current deliverables and approval

Earth Gambler latest earth-gambler-v3.png: user removed overcoat and requested
younger adventurer. Young adult green elf with dark half-tied hair, hip-length
emerald jerkin/ivory sleeves, utility belt/pouches/trousers/boots, modest gold
jewellery, charming shifty smile. Three onlookers now skeptical/suspicious rather
than admiring. Cup game and sage setting retained; exact prompt alongside.
Supersedes Earth gambler v2 only, other gamblers remain v2. Awaiting review.

Gamblers revised per user: standing beside tables, wealthy bling, charming and
shifty, with other people from their own elemental kingdoms gathered around.
Latest water-gambler-v2.png (backgammon, three blue-clad human guests),
fire-gambler-v2.png (dice, three horned guests), earth-gambler-v2.png (three-cup
game, three green elf guests), air-gambler-v2.png (cards, two ivory/slate human
guests). Main gamblers remain dominant, same identities and element skies.
Exact built-in edit prompts alongside. Earlier seated versions preserved;
new versions awaiting review.

Gamblers added 3 November, awaiting review: wealthy, charming and shifty, each
with distinct game and subtle concealed cheating. water-gambler.png (heavyset
clean-shaven human man/backgammon), fire-gambler.png (horned moustached man/dice),
earth-gambler.png (mature green elf woman/three-cup shell game), air-gambler.png
(dark-skinned human woman/cards). Exact prompts alongside. All built-in imagegen,
four suit-motif strokes visually checked; Water corrected with extra edit and
enlarged crop. Element sky/light consistency retained. No rank numbers assigned.

Latest Earth Smith earth-smith-v3.png: entirely fresh generation without any
Earth Smith reference per user request, open-air forge with prominent visible
stone furnace/fire/chimney and substantial stone wall; green elf actively
forges shovel at anvil. Sage sky, four tonal sleeve zigzags. Prompt records
only Water Thief style, Earth Shepherd palette and symbol sheet as references.
Supersedes Earth v2, previous files retained; awaiting review.

Latest Water Smith water-smith-v4.png: two tall round-arched ocean windows
starting nearer floor, right opening cropped at right card edge with no right
vertical jamb visible. Ceiling out of frame; smith/action/goblet preserved.
Exact prompt alongside, supersedes v3. Awaiting review.

Latest Water Smith water-smith-v3.png: user liked smith but requested higher
ceiling out of view and larger ocean window extending to upper-right corner,
without visible top frame. Tall stone walls replace roof beams; bottom sill and
slim right reveal remain, left opening meets wall above/behind smith. Standing
active hammering pose/goblet retained. Exact edit prompt alongside. Supersedes v2.

Smith batch added 3 November, awaiting review. User specified elemental objects:
Earth shovel, Fire axe, Water goblet, Air spearhead. Current candidates:
earth-smith-v2.png (green elf forging socketed shovel spade), fire-smith-v2.png
(horned woman forging axe head), water-smith-v2.png (standing human woman in
enclosed forge, active raised hammer over goblet; ocean seen only through upper
right window per user correction), air-smith.png (older human man forging
socketed spearhead with warm cream Air lighting). Exact prompts alongside.
Earlier Earth grindstone/axe and Water seated outdoor drafts are superseded.
User explicitly said Shepherds are great; Water Shepherd eye-clasp revision
remains latest water-shepherd-v2.png.

Water Shepherd update: user said character looks great but requested replacing
bone cloak clasp with blue Greek eye (nazar) from supplied reference. Latest
water-shepherd-v2.png has small concentric blue eye clasp, rest preserved.
Exact edit prompt alongside; reference references/greek-blue-eye.png.

Shepherds added 3 November, awaiting review: water-shepherd.png (human woman,
coastal salt-meadow sheep, blue sky), fire-shepherd.png (horned bearded man,
volcanic grazing terraces, ember-red sky), earth-shepherd.png (elderly green
elf woman, forest clearing sheep, sage sky), air-shepherd.png (clean-shaven
human man, alpine goats, approved cream sky/warm mountains and stone).
Each has a continuous long hooked crook, druidish wool clothing with simple
plant/seed/bone ties, protective watchfulness and a subtle four-stroke motif.
Exact built-in generation/edit prompts paired alongside each file. No rank
number assigned. Air's previous Thief/Warrior/Fisher approval remains as above.

User APPROVED latest Air images ("looks good") and explicitly confirmed this
sky colour for future Air cards. Approved: air-thief-cream-sky-v4.png,
air-warrior-v6.png, air-fisher-v6.png. Keep cream #E2C98A sky and coherent warm
mountain/stone lighting. Establish consistent sky colour within every element:
Water clear cobalt/azure blue, Fire ember/crimson red-orange, Earth pale muted
sage/green, Air cream #E2C98A. Allow gentle related gradients and atmospheric
variation without changing each suit's established sky identity.

Latest Air stonework correction: user flagged blue stone shadows under cream
light. Current candidates air-thief-cream-sky-v4.png, air-warrior-v6.png and
air-fisher-v6.png. Stone shadows now neutral warm grey/taupe and sunlit stone
cream; cast-shadow definition/depth and compositions retained. Fisher water
remains blue. Built-in targeted edits, exact prompts alongside. These supersede
earlier Air versions below; all previous files retained. Awaiting review.

Latest Air lighting correction: user found mountains too blue beneath cream
sky. Current candidates are air-thief-cream-sky-v3.png, air-warrior-v5.png and
air-fisher-v5.png. Targeted built-in imagegen edits give mountains warm stone
grey/taupe/ochre, cream-lit ivory snow and muted grey/lavender shadows. Character
and composition retained; Fisher lake stays blue. Exact prompts alongside.
These supersede prior Air candidates below; originals remain. Awaiting review.

Air sky follow-up: user found missed areas in PhotoCraft versions and asked for
natural regeneration. Latest candidates now air-thief-cream-sky-v2.png,
air-warrior-v4.png and air-fisher-v4.png. Built-in imagegen targeted edits
integrate cream skies, ivory/warm-grey clouds and small gaps naturally, retaining
the characters/compositions and cool blue mountain/lake colours. Exact prompts
are alongside images. These supersede the PhotoCraft candidates below; all
previous files preserved. Awaiting user review.

Air sky correction, 3 November: user requested only the three Air cards' skies
changed toward RGB 226,201,138 (#E2C98A), allowing related gradients. Latest
Air images: air-thief-cream-sky.png, air-warrior-v3.png, air-fisher-v3.png.
These are deterministic PhotoCraft sky-selection/gradient-map edits, no image
regeneration. Source images preserved. Reproducible steps saved beside each
as *-colour-correction.json. Other suits untouched. Use cream Air skies going
forward. Existing characters, compositions and scenery remain intact.

Fishers added 3 November 2026, awaiting review. Final user direction supersedes
the initial theft concept: NO fishing valuables or stealing. All carry proper
long rods with reels, sly/crafty and a little dangerous, strong individual faces
rather than pretty models or grotesque creepy old caricatures. Exactly two are
actively fishing: Water in ocean and Earth in river. Fire and Air carry rods.
Latest candidates: water-fisher.png, fire-fisher-v2.png, earth-fisher-v2.png,
air-fisher-v2.png. Exact generation/edit prompts are paired beside images.
Water was generated fresh after user discarded the first ugly caricature.
Earlier Fire/Earth/Air theft versions are superseded, not current candidates.

Warriors added 3 November 2026, awaiting user review. Latest candidates:
- water-warrior-v3.png: fierce woman, substantially larger straight two-handed
  longsword; no cheek scar, hip-length coat without hanging blue front panels.
- fire-warrior-v2.png: fierce horned axe warrior; copied cheek scar removed.
- earth-warrior-v4.png: clean-shaven athletic elf with broader natural waist,
  spear instead of sword and taller tapered shield. User requested continuous
  Earth motif pattern across shield face; result has five repeating zigzag
  bands rather than an isolated four-part badge. Tall shield enters former
  upper-right label area. Prior v3 remains intact.
- air-warrior-v2.png: fierce human curved-sword warrior with buckler; larger
  sword, broad full-scale stone bridge, four wrist bars, no copied cheek scar.
Exact built-in generation/edit prompts are alongside each image. Do not copy
Soldier poses into Warriors. User wants fierce independent Warriors, and only
the rendering style copied from the Water Thief, never its personal scars or
other distinctive facial features. No hierarchy rank number assigned yet.

Update, 3 November: user said they are generally happy with the style of each
thief and requested only missing motif strokes. Water's corrected candidate is
water-thief-motif-v2.png, visually checked to contain exactly four blue waves.
Its exact built-in image-generation edit prompt is water-thief-motif-v2-prompt.txt.
Original water-thief.png remains intact as the selected style anchor.
Earth and Fire already have four strokes. Air has four bar traces on close
inspection, though its central pair are faint; no extra bar is needed.
Keep the existing styles; do not simplify or restyle them based on earlier review.

- water-thief.png: final selected Water Thief. User explicitly approved the
  character and subsequently requested natural wood on the enemy boat and calm
  water without white reflections. This is the latest result of those edits.
- fire-thief.png: completed first roleplay pass of original horned woman
  eavesdropping outside enemy tent. Awaiting user review.
- earth-thief.png: completed first roleplay pass of original green elf spying
  through enemy fortress window from a tree branch. Awaiting user review.
- air-thief.png: completed first roleplay pass of original older woman lifting
  a fortress key while a guard sleeps. Awaiting user review.
- *-thief-prompt.txt: consolidated reusable briefs, paired with general-prompt.md.
- prompt-history/: exact recorded generation/edit prompts, retained for provenance.

All four artworks used built-in image generation. No new cards are requested
by this handoff alone. Do not claim Fire/Earth/Air have user approval yet.

## Settled visual direction

The original deck was good but too detailed and realistic. Rider–Waite cards
were examined for simpler colour grouping and clearer ink. The user does not
want to go all the way to flat colour and heavy uniform outlines. Iteration
established the current Water Thief as the desired middle ground:

- Strong confident irregular dark contours; economical internal drawing.
- Broad base colour plus one or two large shadow shapes; generous calm areas.
- Some hand-painted variation and depth, with far fewer small tones/highlights.
- Simple expressive faces; avoid handsome generic heroes. Characterful noses,
  asymmetry and selected scars can communicate personality without fine texture.
- Few major folds, grouped hair and landscape masses, sparse material marks.
- Calm water with low-contrast blue ripples, no white reflection streaks/sparkles.
- Distinct characters and poses across suits; do not recolour the Water pirate.

## Elemental motifs — particularly important

Palette and environment establish the suit first. The motif is a secondary
in-world detail: small tattoo, tonal fabric pattern/embroidery or object engraving.
No big chest pennants, bright badges, ivory contrast patches or large pendants.
Do not copy conspicuous badges from original deck references.

Preserve exactly four parts and correct orientation: Air straight horizontal
bars; Fire vertical wavy strokes; Water horizontal waves; Earth stacked angular
zigzag bands. Compare references/elemental-symbols.png rather than inventing icons.

Known QA lesson: generations sometimes omit/add a motif stroke despite the
written prompt. The original Water style anchor has three apparent waves;
water-thief-motif-v2.png is its corrected four-wave candidate. Keep water-thief.png as the selected
rendering anchor. Air's tiny roleplay wrist mark was inspected and has four bar
traces, its central pair faint. Foretold v2 has its own completed motif audits
and corrections. Inspect marks enlarged when necessary; do not enlarge the
motif in the artwork merely to count it. Never treat prompt compliance as visual
proof, and do not regenerate selected artwork without a request.

## Story, anatomy and object lessons

Enemy targets should not automatically wear the character's suit colours.
The Water Thief sabotages an unpainted natural wooden boat, not a blue allied boat.
Fire's enemy tent is neutral canvas. Use neutral materials where faction is unknown.

Water required many attempts to fix hand/arm anatomy and branched ropes. Preserve
its latest natural crouching pose, simple continuous rope path, visible hawse hole,
hand below the cut, and knife crossing the rope approximately perpendicular.
For future cards, choose a simpler action/pose if necessary rather than preserving
an impossible joint, mirrored hand or ambiguous grip. Check left/right hands,
connected shoulders/elbows/wrists and continuous weapon handles explicitly.

## Composition and working practice

Full-bleed portrait about 5:7. Quiet upper-right label zone: rightmost 22% of width
within upper 25% of height. No baked-in text, numbers, borders or frames.
One dominant character, one clear action, a few meaningful objects.

Keep the original deck in the parent folder separate from roleplay. Original
Fire/Earth/Air thief images can supply character/pose only when available;
roleplay versions are sufficient to continue elsewhere. Latest user authorized
three subagents for the thief batch; this was completed. No ongoing agent tasks.

Earlier roleplay Water drafts were deleted at the user's request after selection.
Original deck art was preserved. The selected art and prompts moved into this
roleplay folder. Do not delete further files without an instruction. New revisions
should be versioned siblings until the user selects replacements.
