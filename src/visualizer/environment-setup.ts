import * as THREE from "three";
import { cardsCastShadows, castsShadow, shadowResolution } from "./device-limits";
import wizardTableModel from "../assets/models/wizard/Wizard.glb?url";
import {
  AMBIENT,
  DEFAULT_TORCH,
  LIGHTING,
  OVERHEAD_LIGHT,
  SHADOWS,
  TORCH_OVERRIDES,
} from "./config";

// The table environment's look, shared by the game table and the background
// scene behind the other pages: renderer settings, ambient light, and the
// lights and shadows in Wizard.glb driven from config.ts.

// Imported rather than written as a path so Vite copies it into the build with
// a hash of its contents in the name: a re-exported table reaches players as a
// new URL, which their cache cannot confuse with the old one.
export const WIZARD_TABLE_MODEL_URL = wizardTableModel;

// three's GLTFLoader sanitises names: "torch.001" arrives as "torch001", and
// duplicates gain a "_1" suffix. Compare on a canonical form so config keys
// can stay written the way Blender shows them.
const canonicalName = (name: string): string =>
  name
    .replace(/_\d+$/, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();

const TORCH_OVERRIDES_BY_CANONICAL = new Map(
  Object.entries(TORCH_OVERRIDES).map(([k, v]) => [canonicalName(k), v]),
);

const TORCH_NAME_RE = /^torch\d+$/;
const SHADOW_CASTER_NAME_RE = /chair|table|card/i;
const GROUND_PLANE_NAME = "ground";
// Walk up from a torch's light to its collection-instance root ("torch.003"),
// which is what TORCH_OVERRIDES is keyed by.
function findTorchRootName(object: THREE.Object3D | null): string | null {
  for (let o = object; o; o = o.parent) {
    const name = canonicalName(o.name);
    if (TORCH_NAME_RE.test(name)) return name;
  }
  return null;
}

// The torch flames to throw sparks from: each torch's point light, which sits
// in its flame.
export function torchFlames(root: THREE.Object3D): THREE.Object3D[] {
  const flames: THREE.Object3D[] = [];
  root.traverse((object) => {
    const light = object as THREE.PointLight;
    if (light.isPointLight && findTorchRootName(light)) flames.push(light);
  });
  return flames;
}

export function configureRenderer(renderer: THREE.WebGLRenderer): void {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = {
    hard: THREE.BasicShadowMap,
    pcf: THREE.PCFShadowMap,
    soft: THREE.VSMShadowMap,
  }[SHADOWS.type];
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = AMBIENT.exposure;
}

export function createAmbientLight(): THREE.AmbientLight {
  return new THREE.AmbientLight(new THREE.Color(...AMBIENT.color), AMBIENT.intensity);
}

// Lights from config, shadow casters by name, and any character left baked
// into the export hidden.
export function prepareEnvironment(root: THREE.Object3D): void {
  root.traverse((object) => {
    // Lights: the exported intensities don't match how they looked in
    // Blender, so drive them from config.ts instead.
    const light = object as THREE.Light;
    if (light.isLight) {
      if ((light as THREE.PointLight).isPointLight) {
        const torchName = findTorchRootName(light);
        const override =
          (torchName && TORCH_OVERRIDES_BY_CANONICAL.get(torchName)) || {};
        const settings = { ...DEFAULT_TORCH, ...override };
        light.intensity =
          LIGHTING.torchIntensity *
          LIGHTING.scale *
          settings.brightnessMultiplier;
        if (settings.color) light.color = new THREE.Color(...settings.color);
        light.castShadow =
          settings.castShadows && castsShadow((light as THREE.PointLight).isPointLight === true);
        (light as THREE.PointLight).decay = LIGHTING.falloff;
      }
      if ((light as THREE.SpotLight).isSpotLight) {
        (light as THREE.SpotLight).decay = LIGHTING.falloff;
        light.intensity = LIGHTING.overheadIntensity * LIGHTING.scale;
        if (OVERHEAD_LIGHT.color) {
          light.color = new THREE.Color(...OVERHEAD_LIGHT.color);
        }
        light.castShadow =
        OVERHEAD_LIGHT.castShadows && castsShadow((light as THREE.PointLight).isPointLight === true);
      }
      // Only the shadow-casting light types carry a `shadow`.
      const caster = light as THREE.PointLight | THREE.SpotLight;
      if (caster.castShadow && caster.shadow) {
        const side = shadowResolution((caster as THREE.PointLight).isPointLight === true);
        caster.shadow.mapSize.set(side, side);
        caster.shadow.bias = -SHADOWS.shadowBias;
        caster.shadow.normalBias = SHADOWS.normalOffsetBias;
        caster.shadow.intensity = SHADOWS.intensity;
        if (SHADOWS.type === "soft") {
          caster.shadow.radius = SHADOWS.softRadius;
          caster.shadow.blurSamples = SHADOWS.softSamples;
        }
      }
    }

    // Players are spawned at runtime; hide any character left baked into
    // the environment export. Seat targets are empties, so never affected.
    if ((object as THREE.SkinnedMesh).isSkinnedMesh) object.visible = false;

    const mesh = object as THREE.Mesh;
    if (mesh.isMesh) {
      if (SHADOW_CASTER_NAME_RE.test(mesh.name)) {
        // Runtime cards are cloned from these meshes, so this flag reaches
        // them too.
        mesh.castShadow = !/card/i.test(mesh.name) || cardsCastShadows();
        mesh.receiveShadow = true;
      } else if (mesh.name === GROUND_PLANE_NAME) {
        mesh.receiveShadow = true;
      }
    }
  });
}
