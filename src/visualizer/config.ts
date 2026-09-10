// Tweakable scene parameters. Edit and reload — no build step needed.
//
// ─────────────────────────────────────────────────────────────────────────
// WANT SHARPER SHADOWS?  → SHADOWS.type = "hard", raise SHADOWS.resolution,
//                          lower SHADOWS.penumbraSize.
// WANT DARKER SHADOWS?   → lower AMBIENT.* and DEFAULT_TORCH.brightnessMultiplier.
//                          (SHADOWS.intensity is already at its 1.0 maximum;
//                          washed-out shadows are almost always fill light,
//                          not the shadow itself. See AMBIENT below.)
// ─────────────────────────────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════════════════
// SHADOWS
// ══════════════════════════════════════════════════════════════════════════

export const SHADOWS = {
  // "hard" — single-sample PCF. Crisp, sharply defined edges everywhere.
  //          Cheapest and by far the sharpest option.
  // "pcf"  — 3x3 filtered PCF. Slightly softened edges, hides stair-stepping.
  // "soft" — PCSS. Penumbra widens with distance from the caster (contact
  //          hardening), the closest approximation to raytraced shadows.
  //          Sharp at contact points, soft further away.
  type: "hard" as "hard" | "pcf" | "soft",

  // Shadow map size in px. This is the single biggest lever on sharpness —
  // more texels covering the same area means finer detail in the shadow.
  // 1024 / 2048 / 4096. Above 4096 costs a lot for little gain.
  resolution: 4096,

  // How dark shadowed areas go. 0 = invisible, 1 = fully occluded (max).
  // Already maxed — if shadows still look weak, it's fill light. See AMBIENT.
  intensity: 1,

  // Bias pushes shadow lookups away from the surface to avoid self-shadowing
  // artifacts. Too HIGH detaches the shadow from the object ("peter-panning",
  // which reads as soft/floaty). Too LOW gives shadow acne (stripey noise).
  // Lowered from 0.02 — that was high enough to visibly detach shadows.
  normalOffsetBias: 0.004,
  shadowBias: 0.002,

  // ── "soft" (PCSS) only — ignored for "hard" and "pcf" ──
  // Effective light size. THE sharpness control for soft shadows: smaller =
  // tighter penumbra = sharper. Was 1.5, which read quite blurry.
  penumbraSize: 0.35,
  // How fast the shadow softens with distance. Higher = stays sharper longer.
  penumbraFalloff: 3,
  // Sample counts. Higher = smoother gradients, more GPU cost.
  samples: 16,
  blockerSamples: 16,
};

// ══════════════════════════════════════════════════════════════════════════
// AMBIENT / FILL LIGHT  — the real "how dark are my shadows" controls
// ══════════════════════════════════════════════════════════════════════════
//
// A shadow is only as dark as whatever else is lighting that spot. Ambient
// light and the skybox illuminate surfaces regardless of occlusion, so they
// set the floor on how dark a shadow can ever get. Turn these down to make
// shadows read strongly; turn them up if the scene goes too murky.

export const AMBIENT = {
  // Base light applied to everything, [r, g, b] 0-1. Near-black = deepest
  // shadows. A slight blue reads as moonlight rather than dead black.
  color: [0.02, 0.025, 0.04] as [number, number, number],

  // How much the procedural sky contributes as ambient light. This is a big
  // one at night — the sky dome fills shadows in from every direction.
  skyboxIntensity: 0.15,

  // Overall scene brightness multiplier applied after lighting. Lower for a
  // darker, higher-contrast image.
  exposure: 1,
};

// ══════════════════════════════════════════════════════════════════════════
// SKY
// ══════════════════════════════════════════════════════════════════════════

export const SKY = {
  elevation: -85, // sun angle; negative = below horizon (night)
  azimuth: 0,
  starBrightness: 0.4,
  starDensity: 1,
  moonIntensity: 1.5,
  nightBrightness: 0.03, // raises the darkest parts of the sky — also fills shadows
  twilightGlow: 0.1,
};

// ══════════════════════════════════════════════════════════════════════════
// LIGHT INTENSITY
// ══════════════════════════════════════════════════════════════════════════

export const LIGHTING = {
  // Overall multiplier applied on top of the base intensities below.
  // The scene renders much dimmer here than it looked in Blender, so bump
  // this up/down to compensate.
  scale: 10,

  // Base intensity (before `scale`) for the torch point lights.
  torchIntensity: 0.25,

  // Base intensity (before `scale`) for the overhead spot light.
  overheadIntensity: 0.4,
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

// Applied to any torch not listed in TORCH_OVERRIDES below.
//
// IMPORTANT for shadow darkness: these torches do NOT cast shadows, so they
// light shadowed areas straight through the objects that should be blocking
// them — the main reason shadows look washed out. Drop brightnessMultiplier
// to deepen shadows; raise it for a brighter but flatter scene.
export const DEFAULT_TORCH: TorchSettings = {
  color: [1, 0.55, 0.25], // warm orange — the raw exported torch color reads too red in-engine
  castShadows: false,
  brightnessMultiplier: 0.35, // lowered from 1 so the shadow-casting torches dominate
};

// Per-torch overrides, keyed by the torch's entity name in the scene
// hierarchy (torch.001 .. torch.006, matching Blender's collection instances).
// Only list what differs from DEFAULT_TORCH — unlisted fields fall back to it.
//
// NOTE: an earlier version of this file documented that torch.001 + torch.003
// sit ~90-120° apart around the table and were found (by testing) to cancel
// each other's shadows out — each torch's light fills back in the shadow the
// other one casts. torch.002 + torch.006 were used instead as the closest
// angular pair (~32° apart) specifically to avoid that. This config
// deliberately overrides that finding and uses torch.001 + torch.003 anyway
// — if the shadows look washed out/absent, that's the likely cause; swap
// back to torch.002 + torch.006 to confirm.
export const TORCH_OVERRIDES: Record<string, Partial<TorchSettings>> = {
  "torch.001": { castShadows: true, brightnessMultiplier: 3 },
  "torch.003": { castShadows: true, brightnessMultiplier: 3 },
};
