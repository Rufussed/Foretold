import * as THREE from "three";
import { SHADOWS } from "./config";
import { isTouchDevice } from "./device-limits";

// Spreads the cost of moving shadows across frames.
//
// A point light shadows in all six directions, so three draws the whole scene
// six more times for each one that casts. Two torches and the overhead spot
// turned one frame into fourteen passes, and a phone's driver answers a frame
// that long by taking the graphics context away.
//
// The torches cannot simply stop refreshing: each light hangs under an
// animated parent, so its shadow moves, and that movement is the point of
// them. But it need not be recomputed sixty times a second. Each casting
// light keeps its own map and refreshes it every Nth frame, and the lights
// are staggered, so a frame pays for one light's six faces instead of all of
// them at once.

export interface ShadowThrottle {
  // Called once per frame, before rendering.
  update(): void;
}

export function createShadowThrottle(root: THREE.Object3D): ShadowThrottle | null {
  // Desktops draw them every frame, as before.
  if (!isTouchDevice()) return null;

  const every = Math.max(1, Math.floor(SHADOWS.touchPointUpdateEvery));
  const shadows: THREE.LightShadow[] = [];
  root.traverse((object) => {
    const light = object as THREE.PointLight;
    if (!light.isLight || !light.castShadow || !light.shadow) return;
    // Only the six-faced ones are worth staggering; a spot or directional
    // light is a single pass and can stay current.
    if (!(light as THREE.PointLight).isPointLight) return;
    light.shadow.autoUpdate = false;
    light.shadow.needsUpdate = true; // once, so the first frames have shadows
    shadows.push(light.shadow);
  });
  if (!shadows.length) return null;

  let frame = 0;
  return {
    update() {
      frame += 1;
      for (const [index, shadow] of shadows.entries()) {
        // index offsets each light into its own frame of the cycle.
        shadow.needsUpdate = (frame + index) % (every * shadows.length) < 1;
      }
    },
  };
}
