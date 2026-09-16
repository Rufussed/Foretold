import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { createCharacterAnimator } from "../character-animator";
import { loadCharacterAsset, type CharacterId } from "../character-assets";
import { HEADSHOTS } from "../config";
import { frameCharacter } from "../portrait";
import { toDisplayPixels } from "./headshot-pixels";

const cache = new Map<CharacterId, Promise<string>>();
let queue: Promise<unknown> = Promise.resolve();

// Headshots are drawn by the table's own renderer, which already holds the
// seated characters' textures. A renderer of their own would upload every
// texture again, and on phones that can exhaust graphics memory.
let renderer: THREE.WebGLRenderer | null = null;
const waitingForRenderer: Array<(renderer: THREE.WebGLRenderer) => void> = [];

// The page hands over the table's renderer once it's ready, and null on leaving.
export function useHeadshotRenderer(next: THREE.WebGLRenderer | null): void {
  renderer = next;
  if (next) for (const resolve of waitingForRenderer.splice(0)) resolve(next);
}

const currentRenderer = (): Promise<THREE.WebGLRenderer> =>
  renderer ? Promise.resolve(renderer) : new Promise((resolve) => waitingForRenderer.push(resolve));

// A still picture of a character's head and shoulders, as an image URL. Each
// character is rendered once and cached; renders run one at a time.
export function headshotUrl(character: CharacterId): Promise<string> {
  const cached = cache.get(character);
  if (cached) return cached;

  const pending = queue.then(() => renderHeadshot(character));
  queue = pending.catch(() => {});
  cache.set(character, pending);
  pending.catch(() => {
    if (cache.get(character) === pending) cache.delete(character);
  });
  return pending;
}

async function renderHeadshot(character: CharacterId): Promise<string> {
  const asset = await loadCharacterAsset(character);
  const target = await currentRenderer();
  const size = HEADSHOTS.size;

  const scene = new THREE.Scene();
  const key = new THREE.DirectionalLight(0xffffff, HEADSHOTS.keyLightIntensity);
  scene.add(new THREE.AmbientLight(0xffffff, HEADSHOTS.ambientIntensity), key, key.target);
  const camera = new THREE.PerspectiveCamera(HEADSHOTS.fov, 1, 0.01, 100);

  const model = cloneSkinned(asset.template);
  scene.add(model);
  // Pose it on the first frame of its idle, rather than the bind pose.
  const animator = createCharacterAnimator(model, asset.clips, character);
  animator.playLoop("idle");
  const idle = animator.actions().idle;
  if (idle) idle.time = 0;
  animator.update(0);
  frameCharacter(camera, key, model, HEADSHOTS);

  // Float pixels where the device can read them back, so dark areas don't band.
  const float = target.extensions.has("EXT_color_buffer_float");
  const renderTarget = new THREE.WebGLRenderTarget(size, size, {
    type: float ? THREE.FloatType : THREE.UnsignedByteType,
    samples: 4,
  });
  const pixels = float ? new Float32Array(size * size * 4) : new Uint8Array(size * size * 4);

  // Borrow the renderer, leaving it as the table left it.
  const previousTarget = target.getRenderTarget();
  const previousClear = target.getClearColor(new THREE.Color());
  const previousAlpha = target.getClearAlpha();
  try {
    target.setRenderTarget(renderTarget);
    target.setClearColor(0x000000, 0);
    target.clear();
    target.render(scene, camera);
    target.readRenderTargetPixels(renderTarget, 0, 0, size, size, pixels);
  } finally {
    target.setRenderTarget(previousTarget);
    target.setClearColor(previousClear, previousAlpha);
    renderTarget.dispose();
    animator.dispose();
    model.traverse((child) => {
      const mesh = child as THREE.SkinnedMesh;
      if (mesh.isSkinnedMesh) mesh.skeleton.dispose();
    });
  }

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  canvas.getContext("2d")!.putImageData(toDisplayPixels(pixels, size, float ? 1 : 255), 0, 0);
  return canvas.toDataURL("image/png");
}
