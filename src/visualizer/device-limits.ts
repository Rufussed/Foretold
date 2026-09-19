import { RENDER, SHADOWS } from "./config";

// What this device should be asked for. Phones share one pool of graphics
// memory with the rest of the system, and running out does not slow a page
// down: the browser takes the context away and the canvas goes blank for the
// rest of the visit.

export const isTouchDevice = (): boolean =>
  window.matchMedia?.("(pointer: coarse)").matches ?? false;

// The most buffer pixels per CSS pixel to draw.
export const maxPixelRatio = (): number =>
  isTouchDevice() ? RENDER.touchMaxPixelRatio : RENDER.maxPixelRatio;

// The largest side the table scene's own textures keep.
export const tableTextureLimit = (): number =>
  isTouchDevice() ? RENDER.touchTableTextureSize : RENDER.tableTextureSize;

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
