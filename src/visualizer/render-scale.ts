import { RENDER } from "./config";

// The most buffer pixels per CSS pixel this device should be asked for.
export function maxPixelRatio(): number {
  const touch = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  return touch ? RENDER.touchMaxPixelRatio : RENDER.maxPixelRatio;
}

// Keeps the framerate up by drawing fewer pixels when a device cannot keep up,
// and more again when it can.
//
// A fixed resolution has to be chosen for the weakest machine that must run
// well, which wastes every stronger one. This measures instead: the scale
// starts at the configured ceiling and steps down while frames are slow, then
// back up while they are comfortably fast.

export interface RenderScaleOptions {
  // Multiplies the pixel ratio the scene would otherwise use. Starts at max.
  min: number;
  max: number;
  // Frames per second to hold. Below it the scale drops; well above, it rises.
  targetFps: number;
  // Called with the new multiplier; the scene re-sizes its buffers.
  onChange(scale: number): void;
}

export interface RenderScale {
  // Called once per frame with the frame's duration in seconds.
  sample(deltaSeconds: number): void;
  readonly scale: number;
  reset(): void;
}

// A scale change is visible as a moment of softness, so the controller is
// deliberately slow to act: it judges a second of frames at a time, and only
// on frames it has good reason to trust.
const WINDOW_SECONDS = 1;
const STEP = 0.15;
// Rise only when there is real headroom, so the scale does not oscillate
// around the target: fall below it, climb above this.
const HEADROOM = 1.2;

export function createRenderScale(options: RenderScaleOptions): RenderScale {
  const { min, max, targetFps, onChange } = options;
  let scale = max;
  let elapsed = 0;
  let frames = 0;
  // Ignore the first moments: the scene is still loading models and compiling
  // shaders, and those frames say nothing about how it will run.
  let settleRemaining = 2;

  const apply = (next: number) => {
    const clamped = Math.min(max, Math.max(min, Number(next.toFixed(3))));
    if (clamped === scale) return;
    scale = clamped;
    onChange(scale);
  };

  return {
    get scale() {
      return scale;
    },
    reset() {
      elapsed = 0;
      frames = 0;
      settleRemaining = 2;
      apply(max);
    },
    sample(deltaSeconds) {
      // A hidden tab, a breakpoint or a long stall would otherwise read as a
      // single catastrophic frame and drop the scale for no reason.
      if (deltaSeconds <= 0 || deltaSeconds > 0.5) return;
      if (settleRemaining > 0) {
        settleRemaining -= deltaSeconds;
        return;
      }

      elapsed += deltaSeconds;
      frames += 1;
      if (elapsed < WINDOW_SECONDS) return;

      const fps = frames / elapsed;
      elapsed = 0;
      frames = 0;

      if (fps < targetFps) apply(scale - STEP);
      else if (fps > targetFps * HEADROOM) apply(scale + STEP);
    },
  };
}
