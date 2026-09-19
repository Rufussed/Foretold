import { BACKDROP, LIGHTING, RENDER, SHADOWS } from "./config";

// What this device should be asked for. Phones share one pool of graphics
// memory with the rest of the system, and running out does not slow a page
// down: the browser takes the context away and the canvas goes blank for the
// rest of the visit.
//
// Every limit here can be overridden from the query string, because finding
// what a device tolerates means trying combinations, and a phone that has
// just lost a context often refuses the next one until the browser is
// restarted - so each rebuild costs a restart. With these, one session can
// test several settings:
//
//   ?shadows=1        shadow maps on or off
//   ?lights=2         how many torch lights stay lit (-1 for all)
//   ?ratio=1.5        buffer pixels per CSS pixel
//   ?portrait=0       the corner self portrait, which costs a second context
//   ?sharpen=0.45     the sharpen pass
//
// They apply on any device, so a desktop can reproduce a phone's settings.

const params = (): URLSearchParams => new URLSearchParams(window.location.search);

const numberParam = (name: string): number | null => {
  const raw = params().get(name);
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
};

const boolParam = (name: string): boolean | null => {
  const raw = params().get(name);
  if (raw === null) return null;
  return raw !== "0" && raw !== "false";
};

export const isTouchDevice = (): boolean =>
  window.matchMedia?.("(pointer: coarse)").matches ?? false;

// The most buffer pixels per CSS pixel to draw.
export const maxPixelRatio = (): number =>
  numberParam("ratio") ??
  (isTouchDevice() ? RENDER.touchMaxPixelRatio : RENDER.maxPixelRatio);

// The largest side the table scene's own textures keep.
export const tableTextureLimit = (): number =>
  isTouchDevice() ? RENDER.touchTableTextureSize : RENDER.tableTextureSize;

// How hard the sharpen pass is applied, 0 for not at all.
export const sharpenAmount = (): number =>
  numberParam("sharpen") ?? (isTouchDevice() ? RENDER.touchSharpen : RENDER.sharpen);

// Whether this light should cast a shadow at all on this device.
export const castsShadow = (isPointLight: boolean): boolean =>
  !(isPointLight && isTouchDevice() && !SHADOWS.touchPointCastShadows);

// Imagination's PowerVR, as shipped in the Tensor G5 (Pixel 10). One shadow
// map of any size is enough to lose the graphics context there about two
// seconds in, while draw calls (265) and textures (46) sit well within what
// the device manages happily without one. It is a driver fault, not a budget:
// a six-year-old iPad renders the same scene with all three shadow maps.
// PlayCanvas disables WebGPU outright on the same GPU (vendor "img-tec")
// because Chrome's Dawn layer still carries workarounds for it.
//
// Named rather than assumed from "is a phone", so an iPhone or any other
// Android keeps its shadows.
const POWERVR = /powervr|img-?tec|imagination/i;

export function isKnownBadShadowGpu(renderer: { getContext(): WebGLRenderingContext }): boolean {
  try {
    const gl = renderer.getContext();
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    if (!info) return false;
    return POWERVR.test(String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)));
  } catch {
    // A masked or missing extension tells us nothing; assume it is fine.
    return false;
  }
}

// Whether this renderer draws shadows at all.
export const shadowsEnabled = (renderer?: { getContext(): WebGLRenderingContext }): boolean => {
  const override = boolParam("shadows");
  if (override !== null) return override;
  if (renderer && isKnownBadShadowGpu(renderer)) return false;
  return !isTouchDevice() || SHADOWS.touchShadowsAtAll;
};

// Whether the corner self portrait, which costs a second WebGL context, runs.
export const selfPortraitEnabled = (): boolean =>
  boolParam("portrait") ?? (!isTouchDevice() || BACKDROP.touchSelfPortrait);

// How many torch lights to keep lit; -1 for all of them.
export const maxTorchLights = (): number =>
  numberParam("lights") ?? (isTouchDevice() ? LIGHTING.touchMaxTorchLights : -1);

// Whether cards should cast; on touch they do not, which is what lets the
// shadow maps be drawn once and left alone.
export const cardsCastShadows = (): boolean =>
  isTouchDevice() ? SHADOWS.touchCardsCastShadows : true;

// Shadow map side for one light, in pixels.
//
// A point light shadows in all six directions, and three allocates that as a
// 4x2 atlas of this size: at 2048 each torch asks for an 8192x4096 depth
// texture, 128MB, and the table has two of them. Directional and spot lights
// need one map of this size, so they can afford to be sharp while the torches
// cannot. Measured on the home page before this split: 272MB of shadow maps
// for one slowly turning table, which is more than a phone's whole budget.
export function shadowResolution(isPointLight: boolean): number {
  if (isPointLight) {
    return isTouchDevice() ? SHADOWS.touchPointResolution : SHADOWS.pointResolution;
  }
  return isTouchDevice() ? SHADOWS.touchResolution : SHADOWS.resolution;
}
