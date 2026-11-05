# Foretold v2 — complete 60-card remake

Artwork titles now distinguish Wizard and Wizardess, King and Queen, Heir
and Heiress, and Priest and Priestess. The manifest keeps the existing slot
IDs and ranks, with updated display titles and image filenames. The Water
Wizard slot uses the icy surfboard remake from ../water-wizard-surf.png.
The earlier cliff version is saved as water-wizard-cliff.png. Earth Wizardess,
remade from ../earth-sorceress-v2.png, appears alongside Earth Wizard as
additional artwork in the review gallery.

The four original Nobles also have supplemental remakes in this folder.
[Earth Duke](earth-duke.png), [Air Duchess](air-duchess.png), [Fire Duchess](fire-duchess.png), and
[Water Duke](water-duke.png) use the same simplified rendering and suit palettes.
Their prompts are in prompts/. The active deck gallery covers the 60 game slots.

Open [the review gallery](index.html) to browse all 60 deck cards and the additional Earth Wizardess, filter by element, and open full images, originals, exact generation prompts and individual QA notes.

Contact sheets: [Water](review/water-contact-sheet.jpg), [Fire](review/fire-contact-sheet.jpg), [Earth](review/earth-contact-sheet.jpg), [Air](review/air-contact-sheet.jpg).

All 60 final PNGs are saved here. Root originals and runtime game assets remain unchanged. The remake uses the Roleplay master prompt copied into STYLE-GUIDE.md: broad ink/paint shading, simpler gradients and scenery, subtle integrated elemental motifs, and coherent sky/light palettes. Air uses the approved cream sky direction (#E2C98A), with warm neutral mountains and stone shadows.

Earth and Fire Tricksters are fresh designs. Neither previous Trickster artwork nor previous character prompts were consulted. Fire is human rather than demonic; Earth is a sinister, less pretty trickster. Other cards retain source identities, poses, main props and compositions, subject to ordinary generation variation.

The active deck mapping in src/i18n/en.ts and backend card.ts is authoritative: ranks 1–13 are Peasant, Farmer, Citizen, Soldier, Merchant, Priest, General, Thief, Trickster, Seer, Heir, Consort, Monarch. The older card-hierarchy.md lists Noble and different power ranks. Root Noble/knight/sorceress studies are not extra slots in this 60-card deck.

52 suited ranks + four Wizard slots + four Fool slots = 60. Wizard/Fool stay elementless. The four Fool slots share [the original-based Fool remake](fool.png), with all four full-size motifs fitted to the folds of the coat. The Air Wizard artwork uses a cream sky with an open upper right and warm mountain shadows. Selected Consort sources use existing v2/eagle variants. The manifest records the source mappings.

Final checks covered saved image integrity, 60 distinct outputs, all prompt and QA records, elemental palettes, broad shading, identities/poses, anatomy/props and suited motif counts. Individual QA files record remaining small uncertainties. Air Seer's original birds remain near the upper-right label area to preserve its composition. Fire and Earth review notes add detailed observations. These are finished art candidates for user review, not runtime replacements.

manifest.json includes completion status, image dimensions and SHA-256 checksums. prompts/ includes generation and correction histories. qa/ contains individual visual review records. review/ contains thumbnails and contact sheets. Discarded generation attempts remain outside this folder in the generation archive.
