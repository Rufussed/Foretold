# Foretold v2 — complete 60-card remake

Open [the review gallery](index.html) to browse all 60 cards, filter by element, and open full images, originals, exact generation prompts and individual QA notes.

Contact sheets: [Water](review/water-contact-sheet.jpg), [Fire](review/fire-contact-sheet.jpg), [Earth](review/earth-contact-sheet.jpg), [Air](review/air-contact-sheet.jpg).

All 60 final PNGs are saved here. Root originals and runtime game assets remain unchanged. The remake uses the Roleplay master prompt copied into STYLE-GUIDE.md: broad ink/paint shading, simpler gradients and scenery, subtle integrated elemental motifs, and coherent sky/light palettes. Air uses the approved cream sky direction (#E2C98A), with warm neutral mountains and stone shadows.

Earth and Fire Tricksters are fresh designs. Neither previous Trickster artwork nor previous character prompts were consulted. Fire is human rather than demonic; Earth is a sinister, less pretty trickster. Other cards retain source identities, poses, main props and compositions, subject to ordinary generation variation.

The active deck mapping in src/i18n/en.ts and backend card.ts is authoritative: ranks 1–13 are Peasant, Farmer, Citizen, Soldier, Merchant, Priest, General, Thief, Trickster, Seer, Heir, Consort, Monarch. The older card-hierarchy.md lists Noble and different power ranks. Root Noble/knight/sorceress studies are not extra slots in this 60-card deck.

52 suited ranks + four Wizard slots + four Fool slots = 60. Wizard/Fool stay elementless; element prefixes identify deck slots. The root has one Fool source, used for four slot renderings. Selected Consort sources use existing v2/eagle variants; manifest.json records every source mapping.

Final checks covered saved image integrity, 60 distinct outputs, all prompt and QA records, elemental palettes, broad shading, identities/poses, anatomy/props and suited motif counts. Individual QA files record remaining small uncertainties. Air Seer's original birds remain near the upper-right label area to preserve its composition. Fire and Earth review notes add detailed observations. These are finished art candidates for user review, not runtime replacements.

manifest.json includes completion status, image dimensions and SHA-256 checksums. prompts/ includes generation and correction histories. qa/ contains individual visual review records. review/ contains thumbnails and contact sheets. Discarded generation attempts remain outside this folder in the generation archive.
