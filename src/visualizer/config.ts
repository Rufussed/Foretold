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
  resolution: 2048,

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
  // Mouse orbit/pan/zoom, handed over once the intro camera animation has
  // finished (straight away if there isn't one), so the authored camera move
  // still plays untouched first.
  orbitControls: true,

  // Fallback orbit target if the table can't be found; normally the target is
  // placed on the camera's line of sight so taking control doesn't jump.
  target: [0, 1, 0] as [number, number, number],

  // How close and far the orbit controls may be dollied, in scene units.
  minDistance: 1,
  maxDistance: 40,
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
  maxHeight: 1080, // tallest drawing buffer, in pixels
  maxPixelRatio: 1, // never draw more than 1 buffer pixel per CSS pixel
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
