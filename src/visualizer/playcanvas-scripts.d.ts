// PlayCanvas ships these as plain .mjs script modules with no bundled types.
declare module "playcanvas/scripts/esm/camera-controls.mjs" {
  export const CameraControls: typeof import("playcanvas").Script;
}

declare module "playcanvas/scripts/esm/sky/procedural-sky.mjs" {
  export const ProceduralSky: typeof import("playcanvas").Script;
}
