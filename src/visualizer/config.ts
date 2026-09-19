// Tweakable scene parameters. Edit and reload — no build step needed.
//
// Values here are in three.js terms: lights use physical units (candela,
// inverse-square falloff) and shadows use three's shadow-map settings.
//
// ─────────────────────────────────────────────────────────────────────────
// WANT SHARPER SHADOWS?  → SHADOWS.type = "hard", raise SHADOWS.resolution.
// WANT DARKER SHADOWS?   → lower AMBIENT.intensity first, then
//                          DEFAULT_TORCH.brightnessMultiplier. Washed-out
//                          shadows are almost always fill light, not the
//                          shadow setting.
// ─────────────────────────────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════════════════
// SHADOWS
// ══════════════════════════════════════════════════════════════════════════

// Each value notes three's own default, so it's clear what has been changed
// and what to reset to.
export const SHADOWS = {
  // Filtering algorithm: "hard" is crisp but aliased, "pcf" softens the edge,
  // "soft" blurs it uniformly (no distance-based contact hardening — three
  // removed PCFSoftShadowMap and has no PCSS equivalent). three default: pcf.
  type: "pcf" as "hard" | "pcf" | "soft",

  // Shadow map size in px per light; the biggest lever on sharpness, at the
  // cost of memory. three default: 512.
  //
  // This one is for lights that shadow in a single direction (the overhead
  // spot): one map of resolution x resolution, so 2048 costs 16MB.
  resolution: 2048,
  // Point lights - the torches - shadow in all six directions, and three
  // allocates that as a 4x2 atlas of this size. So this number costs
  // 32x its square in bytes: 2048 here was 128MB per torch, and with two
  // torches the backdrop alone wanted more graphics memory than a phone has.
  // Torch shadows are soft and close to their light, so they carry the drop
  // well. Raise only while watching what it costs.
  pointResolution: 512,
  // The same two on phones and tablets, where the browser shares graphics
  // memory with the whole device.
  touchResolution: 1024,
  touchPointResolution: 256,

  // How dark a shadowed area goes, 0 invisible to 1 fully occluded. three default: 1.
  intensity: 1,

  // Offsets the lookup along the surface normal to kill shadow acne without
  // detaching the shadow. three default: 0.
  normalOffsetBias: 0.004,

  // Depth offset to kill acne; too high makes shadows float off their object
  // ("peter-panning"). Applied negated, as three expects. three default: 0.
  shadowBias: 0.002,

  // "soft" only: blur width of the variance shadow. three default: 1.
  softRadius: 1,

  // "soft" only: blur sample count, higher is smoother and slower. three default: 8.
  softSamples: 8,
};

// ══════════════════════════════════════════════════════════════════════════
// AMBIENT  — the real "how dark are my shadows" control
// ══════════════════════════════════════════════════════════════════════════
//
// A shadow is only as dark as whatever else lights that spot. Ambient light
// reaches every surface regardless of occlusion, so it sets the floor on how
// dark a shadow can get. Turn it down for stronger shadows.

export const AMBIENT = {
  // Colour of the light every surface receives regardless of occlusion;
  // near-black keeps shadows deep, a little blue reads as moonlight.
  color: [0.02, 0.025, 0.04] as [number, number, number],

  // Multiplier on that colour. three default: 1.
  intensity: 0.9,

  // Renderer tone-mapping exposure; lower is darker and higher contrast.
  // three default: 1 (and NoToneMapping — this scene uses ACES Filmic).
  exposure: 0.9,
};

// ══════════════════════════════════════════════════════════════════════════
// CAMERA
// ══════════════════════════════════════════════════════════════════════════

export const CAMERA = {
  // Whether mouse orbit/pan/zoom starts switched on; press O to toggle it. For
  // testing: in a live game, a change of turn switches them back off.
  // The controls take over once the intro camera animation has finished
  // (straight away if there isn't one), so the authored move plays first.
  orbitControls: false,

  // Fallback orbit target if the table can't be found; normally the target is
  // placed on the camera's line of sight so taking control doesn't jump.
  target: [0, 1, 0] as [number, number, number],

  // How close and far the orbit controls may be dollied, in scene units.
  minDistance: 1,
  maxDistance: 40,
};

// In a live game the camera turns toward whoever's turn it is, and back to its
// normal view (where the intro camera move ends) on your turn. Orbit controls
// are for testing: a change of turn switches them off, and with them off the
// camera glides back to its normal place.
export const CAMERA_FOLLOW = {
  enabled: true,

  // How far to turn, 0 not at all to 1 looking straight at them, putting the
  // active player in the centre of the view.
  amount: 1,

  // How long a turn takes, in seconds, easing in and out.
  turnSeconds: 3,

  // Pause before the camera starts turning, in seconds. The table director
  // already waits for cards to land, so the turn starts with its announcement.
  delaySeconds: 0,

  // Aim this far above the middle of the player's card set, in scene units:
  // raise it to centre on their face rather than their cards.
  lookHeight: 0.4,
};

// ══════════════════════════════════════════════════════════════════════════
// CHARACTERS
// ══════════════════════════════════════════════════════════════════════════

export interface SeatingCorrection {
  // Offset from the seat target, in Blender axes and seat-local units:
  //   X = sideways along the seat, + to the seat's right
  //   Y = away from the table, - toward it
  //   Z = up
  position?: [number, number, number];
  rotation?: [number, number, number]; // Blender XYZ rotation, in degrees
  scale?: number; // uniform; the seat already supplies ~3x
}

// Seating offsets use Blender's axes and units: they read exactly as the
// Location/Rotation of an object parented to a seat empty would in Blender.
// So +Y is the seat's local Y, and 0.3 is 0.3 on that axis (0.9 in world,
// since the seat scales 3x). Applied to every character.
export const DEFAULT_SEATING: SeatingCorrection = {
  // Seat +Y points away from the table, so negative brings characters forward
  // toward it. Net zero: characters sit exactly on their seat target.
  position: [0, 0, 0],
};

// Extra per-character nudges on top of DEFAULT_SEATING, keyed by character id.
// Positions and rotations add; scale multiplies. No height offsets: every
// character attaches at its seat target's height, so height is set by the
// targets in Blender.
export const CHARACTER_SEATING: Partial<Record<string, SeatingCorrection>> = {
  // position: [x, y, z] offset from the seat target — x sideways, y away from
  // the table (negative toward it), z up. Adds to DEFAULT_SEATING.
  // scale: uniform size multiplier, applied around the character's origin, so
  // it can also raise or lower the feet a little.
  "forest-elf": { position: [0, 0, 0.037], scale: 0.9},
  "blind-wizard": { position: [0, 0, 0.05], scale: 0.95 },
  "black-witch": { position: [0, 0, 0.018], scale: 0.95 },
  "kungfu-girl": { position: [0, 0, -0.05], scale: 0.9 },
  "goatman": { position: [0, 0, 0], scale: 0.85 },
  "demon": { position: [0, 0, -0.015], scale: 0.9 },
};

// ══════════════════════════════════════════════════════════════════════════
// RENDER RESOLUTION
// ══════════════════════════════════════════════════════════════════════════

// The scene is drawn at canvasHeight x pixelRatio pixels, so a 4K display
// costs four times a 1080p one. These cap that: the buffer never exceeds
// maxHeight rows, and the browser scales the result up to fill the canvas.
// Raise maxHeight for sharpness, lower it for framerate.
export const RENDER = {
  maxHeight: 3240, // tallest drawing buffer, in pixels
  maxPixelRatio: 3, // never draw more than 3 buffer pixels per CSS pixel
  // The same cap on phones and tablets, where a 3x panel means drawing nine
  // pixels for every one a laptop draws, on a GPU shared with the rest of the
  // device. Running out of graphics memory does not slow a page down, it takes
  // the context away and leaves a blank canvas.
  touchMaxPixelRatio: 2,
  // Draw this much above the display's own pixel density and let the GPU
  // shrink the result. 1 draws at native, 2 is four times the pixels.
  //
  // Measured 2026-09-19, for why this is 1.5 and not 2: a card fills about
  // 18% of the window's height (0.72 scene units tall, seen from 9.6 units
  // away through a 23.3 degree lens), so on a 1080-tall window it lands on
  // ~196 CSS pixels. Its face is 350x490, so the art is being shrunk, not
  // stretched - a higher-resolution scan would change nothing. What
  // supersampling bought was cleaner minification of a texture read at a
  // grazing angle, and `sharpen` below now does most of that for a fraction
  // of the cost. Above 1.5 the gain is slight and the cost is the square.
  supersample: 1.5,
  // Contrast-adaptive sharpening as the scene is copied to the canvas: one
  // pass over the screen, rather than drawing the whole scene larger. 0 turns
  // it off, 0.35 is gentle, much above 0.8 starts to outline things.
  sharpen: 0.45,
  // Off on touch: it renders through a half-float buffer, which is another
  // ~20MB of graphics memory on a device that has already been seen to run
  // out, and the cards are small enough on a phone that it buys little.
  touchSharpen: 0,
  // Draw fewer pixels when the device cannot hold targetFps, and more again
  // when it can. The multiplier rides on top of everything above, so a strong
  // machine keeps the full image and a weak one stays smooth instead of
  // everybody being held to what the weakest can manage.
  adaptive: {
    enabled: true,
    targetFps: 50,
    min: 0.5,
    max: 1,
  },
  // Character textures are shrunk to at most this many pixels a side as they
  // load. Graphics memory goes with the square: 4096 needs 4x 2048.
  characterTextureSize: 2048,
  // 512, not 1024, because the characters ship 1024px textures: a 1024 limit
  // shrinks nothing at all, which is what it did until this was measured. Six
  // seated characters were 100MB+ of texture on a phone, and the graphics
  // context went with it 1.8 seconds after the table loaded. At the size a
  // character is drawn on a 485px-wide screen, 512 is more than it can show.
  touchCharacterTextureSize: 512,
  // The same for the table scene, which ships ten 1024px textures - about
  // 54MB once they are on the GPU with their mipmaps, and it is on screen
  // behind every page, not only the 3D view. Desktops keep them as exported.
  tableTextureSize: 1024,
  touchTableTextureSize: 512,
};

// ══════════════════════════════════════════════════════════════════════════
// ANIMATION
// ══════════════════════════════════════════════════════════════════════════

export const ANIMATION = {
  // Playback speed for every clip: 1 is as authored, 0.5 half speed.
  // three default: 1.
  timeScale: 1,
};

// ══════════════════════════════════════════════════════════════════════════
// LIGHT INTENSITY
// ══════════════════════════════════════════════════════════════════════════

// three.js uses physical light units: point/spot intensity is candela and
// falls off with the inverse square of distance. The torches sit ~6-8 units
// from the table, so values are in the tens-to-hundreds, not fractions.
export const LIGHTING = {
  // Global multiplier over both intensities below, for dimming or brightening
  // the whole scene in one place.
  scale: 1,

  // Candela for each torch point light, before `scale` and the per-torch
  // multiplier. Falls off as 1/d², so ~90 reads as a modest pool at 6-8 units.
  torchIntensity: 90,

  // Candela for the overhead spot, before `scale`; it sits higher up, so it
  // needs a larger figure than the torches to land with similar strength.
  overheadIntensity: 200,

  // How fast light falls off with distance, and so how far a torch throws.
  // 2 is physically correct (inverse-square); 1.5 or 1.2 spreads the pool
  // much wider without blowing out the area right beside the flame, whereas
  // raising intensity needs 4x the candela to double the reach.
  // three default: 2.
  falloff: 1.8,
};

// The overhead "top light" spot. Casts shadows alongside the override
// torches below.
export const OVERHEAD_LIGHT: {
  color: [number, number, number] | null;
  castShadows: boolean;
} = {
  color: null, // [r, g, b] 0-1 to override, or null to keep the glTF-exported color
  castShadows: true,
};

// ══════════════════════════════════════════════════════════════════════════
// TORCHES
// ══════════════════════════════════════════════════════════════════════════

export interface TorchSettings {
  color: [number, number, number] | null;
  castShadows: boolean;
  brightnessMultiplier: number;
}

// Applied to any torch not listed in TORCH_OVERRIDES below. Every torch
// lights the scene; only the ones listed there also cast shadows.
//
// Note that non-casting torches light straight through objects that should be
// blocking them, so raising this softens the shadows the other two cast.
export const DEFAULT_TORCH: TorchSettings = {
  color: [1, 0.55, 0.25], // warm orange — the raw exported torch colour reads too red
  castShadows: false,
  brightnessMultiplier: 1,
};

// Per-torch overrides, keyed by the torch's name in Blender (torch.001 ..
// torch.006 — three sanitises these to "torch001", which is handled for you).
// Only list what differs from DEFAULT_TORCH.
//
// Shadows come from these two alone: six shadow-casting lights would wash
// each other out, since every torch fills in the shadow the others cast.
export const TORCH_OVERRIDES: Record<string, Partial<TorchSettings>> = {
  "torch.001": { castShadows: true },
  "torch.003": { castShadows: true },
};

// ══════════════════════════════════════════════════════════════════════════
// AVATAR PICKER  (waiting room)
// ══════════════════════════════════════════════════════════════════════════

// Framing for the six live avatar portraits. Each camera sits at face height,
// in front of the character; its facing is read from the rig. Sizes are in
// multiples of each character's own hip-to-face height, so characters of
// different sizes are framed alike.
export const AVATAR_PICKER = {
  // Vertical field of view of each portrait camera, in degrees. three default: 50.
  fov: 30,

  // How much of the character fits vertically: 1 is hips to face, larger
  // zooms out.
  span: 1.6,

  // Where the camera aims, relative to the face: 0 looks straight at it,
  // negative tilts down the body while the camera stays at face height.
  lookOffset: -0.3,

  // Turns the camera around the character, in degrees; 0 is straight on.
  azimuthDegrees: 0,

  // The one light, placed at the camera and aimed at the face.
  keyLightIntensity: 3,

  // Fill, so the side away from the key light isn't pure black. three default: 1.
  ambientIntensity: 0.6,

  // Taken avatars are drawn this much dimmer, 0 black to 1 unchanged.
  takenBrightness: 0.3,

  // Portraits are small, so they can afford full sharpness on HD screens.
  maxPixelRatio: 2,

  // Portraits redraw at most this often, leaving headroom for the page.
  targetFps: 30,
};

// ══════════════════════════════════════════════════════════════════════════
// EMOTES
// ══════════════════════════════════════════════════════════════════════════

export const EMOTES = {
  // Blend into an emote and back out to idle, in seconds.
  crossfadeSeconds: 0.2,

  // Minimum gap between emotes on one character, in seconds.
  cooldownSeconds: 1.5,

  // A press during the cooldown: "queue" plays the newest press once it ends,
  // "drop" ignores it.
  onCooldownHit: "queue" as "queue" | "drop",

  // Stand-in for AI players deciding to emote: bots in a live game, or every
  // seat on the demo table, emote at random within this many seconds.
  aiEnabled: true,
  aiMinSeconds: 6,
  aiMaxSeconds: 15,
};

// ══════════════════════════════════════════════════════════════════════════
// DEV CONTROLS  (dev builds only)
// ══════════════════════════════════════════════════════════════════════════

export const DEV = {
  // "/" steps every seat through the clips; "." rotates the characters round
  // the seats, on the demo table only (a live game seats the real players).
  demoControls: true,
};

// ══════════════════════════════════════════════════════════════════════════
// SELF PORTRAIT  (your own character, bottom right of the table view)
// ══════════════════════════════════════════════════════════════════════════

// Same framing controls as AVATAR_PICKER; the size on screen is set in CSS
// (.visualizer-self-view in style.css).
export const SELF_PORTRAIT = {
  // Vertical field of view, in degrees. three default: 50.
  fov: 36,

  // How much of the character fits vertically, in hip-to-face heights. Lower
  // fills the box more; too low crops raised-arm emotes.
  span: 1.95,

  // Aim relative to the face: 0 straight at it, negative tilts down the body.
  lookOffset: -0.35,

  // Turns the camera around the character, in degrees; 0 is straight on.
  azimuthDegrees: 0,

  // The one light, at the camera and aimed at the face.
  keyLightIntensity: 3,

  // Fill so the side away from the key light isn't pure black. three default: 1.
  ambientIntensity: 0.6,

  maxPixelRatio: 2,
  targetFps: 30,
};

// ══════════════════════════════════════════════════════════════════════════
// CARDS  (code-generated faces, until handmade textures replace them)
// ══════════════════════════════════════════════════════════════════════════

export const CARDS = {
  // Face colour for each suit, as CSS colours.
  suitColors: {
    Red: "#c62828",
    Green: "#2e7d32",
    Blue: "#1565c0",
    Yellow: "#f9a825",
  } as Record<string, string>,

  // Trump card colour when there's no trump suit: a Jester was turned up, or a
  // Wizard whose suit hasn't been chosen yet.
  noTrumpColor: "#8a8a8a",

  // Wizard and Jester faces: these suits' colours, top of the card to bottom.
  specialCardGradient: ["Red", "Yellow", "Green", "Blue"],

  // Face colour of cards whose faces you never see: other players' hands and
  // the stack. Only glimpsed edge-on, if at all.
  hiddenFaceColor: "#d8d2c4",

  // Pixel size of each generated face; 5:7, matching the card mesh.
  textureWidth: 512,
  textureHeight: 716,

  // Corner label height, as a fraction of the card width.
  labelSize: 0.18,

  // White outline around the label, as a fraction of the label height.
  outlineWidth: 0.08,

  // Gap from the card's top and side edges to the outlined number, as a
  // fraction of the label height. The mesh's corners are rounded to about
  // 0.25 of the label height, so much below 0.1 starts to clip.
  labelMargin: 0.12,
};

// ══════════════════════════════════════════════════════════════════════════
// CARD HANDLING  (your hand, on the scene canvas)
// ══════════════════════════════════════════════════════════════════════════

export const CARD_HANDLING = {
  // Outline around the card under the pointer, or being dragged.
  outlineColor: "#ffd54f",

  // Outline thickness on each side, as a fraction of the card width.
  outlineWidth: 0.015,

  // How far a clicked card rises, in card lengths.
  raiseLengths: 0.5,

  // How far above the hand a dragged card must be dropped to play it, in card
  // lengths. Separate from raiseLengths, so a small raise doesn't make cards
  // easy to play by accident.
  playLineLengths: 1.2,

  // How quickly cards glide to where they're going; higher is snappier.
  followSpeed: 12,

  // Pointer travel, in pixels, before a press becomes a drag instead of a click.
  dragThresholdPx: 6,

  // A card counts as dropped on the play area when released above where the
  // raised cards sit, plus this many pixels.
  playAreaMarginPx: 0,

  // How long a played card waits for the server to accept it before it
  // returns to the hand.
  pendingPlaySeconds: 5,
};

// ══════════════════════════════════════════════════════════════════════════
// DEALING  (at the start of each round, from the stack at the table's centre)
// ══════════════════════════════════════════════════════════════════════════

export const DEALING = {
  // How far above the top of the stack a card travels, in scene units.
  liftHeight: 0.9,

  // Rising straight up off the stack, staying flat.
  liftSeconds: 0.15,

  // Travelling flat to above where it's going.
  travelSeconds: 0.35,

  // How far past its place the card carries on, away from the table's middle,
  // before it turns and settles back into the fan: without this it turns where
  // it lands and clips through the cards beside it. In scene units.
  approachDistance: 1,

  // Turning into place as it settles.
  settleSeconds: 0.5,

  // Time between one card leaving the stack and the next. Shorter than the
  // three phases above means several cards are in the air at once.
  intervalSeconds: 0.25,
};

// ══════════════════════════════════════════════════════════════════════════
// OTHER PLAYERS' PLAYS  (bots' pacing is set in the backend: wizardTiming.ts)
// ══════════════════════════════════════════════════════════════════════════

export const OPPONENT_PLAYS = {
  // How far a played card rises out of its player's hand first, in card lengths.
  liftLengths: 1.2,

  // Rising out of the hand.
  liftSeconds: 0.4,

  // Travelling to its played-card slot, turning face up into place on the way.
  travelSeconds: 0.6,
};

// ══════════════════════════════════════════════════════════════════════════
// HEADSHOTS  (the other players' pictures, bottom left)
// ══════════════════════════════════════════════════════════════════════════

// Framing controls as for AVATAR_PICKER, tighter to show head and shoulders.
export const HEADSHOTS = {
  // Rendered image size in pixels; shown smaller, so it stays sharp.
  size: 128,
  fov: 30,
  // How much of the character fits vertically, in hip-to-face heights.
  span: 0.75,
  // Aim relative to the face: 0 straight at it, negative tilts down.
  lookOffset: -0.05,
  azimuthDegrees: 0,
  keyLightIntensity: 3,
  ambientIntensity: 0.7,
};

// ══════════════════════════════════════════════════════════════════════════
// TRICK REWARD  (a tesseract for the winner of each trick)
// ══════════════════════════════════════════════════════════════════════════

export const TESSERACT = {
  // Its size at scale 1, in scene units across; the model itself is ~5 units.
  size: 0.5,

  // When tinted to the trump colour. The model's own glow strength is 10 and
  // it's half see-through, which bleaches a colour toward white; a gentler
  // glow and a more solid body keep the trump colour dominant.
  tintGlow: 1.5,
  tintOpacity: 0.9,
};

export const TRICK_REWARD = {
  // Wait after the trick completes, so the last card lands first
  // (OPPONENT_PLAYS: 0.4s up plus 0.6s across).
  startDelaySeconds: 1.1,
  // Then the finished trick stays on the table this long before it shrinks.
  winnerHoldSeconds: 1,
  // The cards in play shrinking into a point.
  gatherSeconds: 0.5,
  // The tesseract growing from that point to startScale.
  growSeconds: 0.4,
  startScale: 1,
  // Floating to just above the winner's head, at startScale.
  floatSeconds: 1.2,
  // Swelling to peakScale there.
  swellSeconds: 0.4,
  peakScale: 2,
  // Diving down into their head as it shrinks away; quick.
  diveSeconds: 0.25,
  // How far above the winner's head it hovers, in scene units.
  aboveHead: 0.8,
  // For your own wins: how far in front of the camera it hovers.
  cameraDistance: 2.5,
};

// ══════════════════════════════════════════════════════════════════════════
// ANNOUNCER  (the "what's going on" banner, top centre)
// ══════════════════════════════════════════════════════════════════════════

export const ANNOUNCER = {
  // How long each announcement (a prediction, a won hand) stays up before the next.
  messageSeconds: 2.5,
  // How long a rule reminder (after a card that can't be played) stays up at
  // most; it goes sooner if the next card is played first.
  noticeSeconds: 5,
  // End of round: each player's result card appears this long after the last,
  // the round's best first...
  resultRevealSeconds: 1,
  // ...and once every card is showing, they all stay up this long.
  resultHoldSeconds: 10,
};

// ══════════════════════════════════════════════════════════════════════════
// TRUMP CROWN  (the 👑 hovering over the middle of the trump card)
// ══════════════════════════════════════════════════════════════════════════

// Values ending in Lengths are card lengths, so they keep their size relative to the card.
export const TRUMP_CROWN = {
  sizeLengths: 0.45, // how big the crown is
  verticalOffset: 0.1, // crown height from the card's middle, in scene units; negative is lower
  frontLengths: 0.15, // how far toward the camera, so it sits just in front
  bobLengths: 0.05, // how far it bobs up and down
  bobSeconds: 2.4, // one bob, up and back down
};

// ══════════════════════════════════════════════════════════════════════════
// BACKDROP  (the table scene behind every page but the 3D view)
// ══════════════════════════════════════════════════════════════════════════

export const BACKDROP = {
  // Radius: the camera's distance from the table centre. Starts where the game
  // view's intro camera move ends (12.78: 11.76 out and 5 up).
  radius: 36,
  // Camera height above the table centre; must be less than radius.
  height: 5,
  // Seconds for one full circle of the table.
  secondsPerTurn: 60,
  // Where the circle starts, in degrees around the table; 180 is where the
  // game view's camera sits.
  startDegrees: 180,
  // Shadows cost a lot for a slow background; switch off for weaker devices.
  shadows: true,
  // Off on phones and tablets: shadow maps are the largest single thing the
  // backdrop asks a device for, and it is decoration behind a sign-in form.
  touchShadows: false,
};

// ══════════════════════════════════════════════════════════════════════════
// MUSIC  (the ambient track looping while the 3D view is open)
// ══════════════════════════════════════════════════════════════════════════

// Beside the tracks they name, rather than at the top of the file, so the
// playlist reads as one block. The build fingerprints an imported file, the
// same as the models and the card art.
import endGame from "../assets/sound/CM.02.EndGame.mp3";
import thoughtWave from "../assets/sound/CM.04.ThoughtWave.mp3";
import medievalAmbient from "../assets/sound/deuslower-medieval-ambient-236809.mp3";

export const MUSIC = {
  // Imported rather than named by path so the build fingerprints them, the same
  // as the models and the card art; the order here is the playing order.
  urls: [medievalAmbient, thoughtWave, endGame],
  volume: 0.35,
};

// ══════════════════════════════════════════════════════════════════════════
// SPARKS  (embers rising from the torches)
// ══════════════════════════════════════════════════════════════════════════

// Distances are scene units, times seconds. Every spark drifts the same way;
// that direction eases to a new random one every windChangeSeconds. Each spark
// also weaves across the drift in a sine wave.
export const SPARKS = {
  enabled: true,
  perTorchPerSecond: 3, // how many sparks each torch gives off
  maxParticles: 300, // most alive at once, across all torches; new ones wait for room
  emitOffsetY: -0.35, // start this far below the torch's light, inside the flame
  emitRadius: 0.1, // scatter of each spark's starting point

  lifeMinSeconds: 10, // each spark lives a random time between these
  lifeMaxSeconds: 20,

  size: 0.15, // size at full flare
  sizeRandomness: 0.5, // fraction each spark's size may vary
  flareFraction: 0.12, // share of its life spent flaring up; then it fades

  speedMin: 0.4, // slowest drift
  speedMax: 1.2, // fastest drift
  rise: 0.05, // upward speed added to the drift (0 lets them fall freely)

  windChangeSeconds: 15, // time to ease to a new drift direction
  windVertical: 0.5, // how far the drift may tilt up or down (0 level, 1 steeply)

  waveFrequency: 0.8, // weaves per second
  waveAmplitude: 0.08, // how far a spark weaves to each side
  waveRandomness: 0.5, // fraction each spark's wave frequency and size may vary

  colorStart: [1, 0.85, 0.45] as [number, number, number], // as it flares
  colorEnd: [1, 0.3, 0.05] as [number, number, number], // as it dies
  brightness: 3, // glow strength
};
