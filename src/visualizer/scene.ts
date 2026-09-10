import * as pc from "playcanvas";
import { CameraControls } from "playcanvas/scripts/esm/camera-controls.mjs";
import { ProceduralSky } from "playcanvas/scripts/esm/sky/procedural-sky.mjs";
import {
  LIGHTING,
  SHADOWS,
  AMBIENT,
  SKY,
  OVERHEAD_LIGHT,
  DEFAULT_TORCH,
  TORCH_OVERRIDES,
} from "./config";
import {
  indexGltfExtras,
  emptyGltfExtrasIndex,
  extrasBoolean,
  type GltfExtrasIndex,
} from "./gltf-extras";

const TORCH_NAME_RE = /^torch\.\d+$/;

// Objects whose name matches this cast AND receive shadows onto each other
// (chairs, the table, the cards on it). The ground plane also receives, but
// doesn't need to cast.
const SHADOW_CASTER_NAME_RE = /chair|table|card/i;

const SHADOW_TYPES = {
  hard: pc.SHADOW_PCF1_32F,
  pcf: pc.SHADOW_PCF3_32F,
  soft: pc.SHADOW_PCSS_32F,
};
const GROUND_PLANE_NAME = "GroundPlane_50m";

const WIZARD_TABLE_MODEL_URL = "/models/wizard/Wizard.glb";

// Walk up from a torch's light entity to find its collection-instance root
// (e.g. "torch.003"), which is what TORCH_OVERRIDES is keyed by.
function findTorchRootName(entity: pc.Entity | null): string | null {
  for (let e = entity; e; e = e.parent as pc.Entity | null) {
    if (TORCH_NAME_RE.test(e.name)) return e.name;
  }
  return null;
}

// Give every skinned mesh its own skeleton AND its own bind matrices.
//
// Two PlayCanvas behaviours collide when a glTF holds more than one Mixamo
// character, because every Mixamo rig ships identical bone names:
//
//  1. Skin objects are cached on the joined bone names (glb-parser
//     `createSkin`), so the second character silently reuses the first
//     character's Skin — and therefore the *first* character's inverse bind
//     matrices. Its own correctly-exported ones are discarded.
//  2. Joints are resolved by name from a root node (`SkinInstance.resolve`),
//     which is the whole scene, so every mesh binds to whichever skeleton
//     is found first.
//
// Together those weld the second character's mesh onto the first one's
// skeleton with the wrong bind pose — it renders as a spaghetti mess.
//
// Rebuilding the bind matrices from each rig's own rest pose reproduces what
// the exporter wrote, since glTF stores `IBM = inverse(jointWorldAtBind)`.
// MUST run before any animation is applied, while bones are still at rest.
function isolateSkin(render: pc.RenderComponent, device: pc.GraphicsDevice): void {
  render.meshInstances.forEach((meshInstance) => {
    const current = meshInstance.skinInstance;
    if (!current) return;

    const boneNames: string[] = current.skin.boneNames;
    if (!boneNames.length) return;

    let root: pc.GraphNode | null = render.entity;
    while (root && !root.findByName(boneNames[0])) {
      root = root.parent;
    }
    if (!root) return;

    const bones = boneNames.map((name) => root.findByName(name));
    if (bones.some((bone) => !bone)) return;

    const bindPose = bones.map((bone) =>
      new pc.Mat4().copy(bone!.getWorldTransform()).invert(),
    );

    const skin = new pc.Skin(device, bindPose, boneNames);
    meshInstance.mesh.skin = skin;

    const skinInstance = new pc.SkinInstance(skin);
    skinInstance.resolve(root as pc.Entity, render.entity);
    meshInstance.skinInstance = skinInstance;

    render.rootBone = root as pc.Entity;
  });
}

// Keep the camera's authored vertical extent visible at every window shape,
// letting the horizontal view widen or narrow instead.
//
// Blender writes an `aspectRatio` into the glTF, which makes PlayCanvas pin
// the camera to ASPECT_MANUAL — it renders that fixed aspect into whatever
// shape the canvas is, i.e. stretched. ASPECT_AUTO matches the camera to the
// canvas instead, removing the distortion. glTF already stores a vertical
// FOV and PlayCanvas anchors to that axis by default, so the authored top
// and bottom of frame then survive at any width.
function lockVerticalFov(camera: pc.CameraComponent): void {
  camera.horizontalFov = false;
  camera.aspectRatioMode = pc.ASPECT_AUTO;
}

export interface WizardSceneHandle {
  app: pc.Application;
  destroy: () => void;
}

export interface WizardSceneOptions {
  onLoading?: (loading: boolean) => void;
  onError?: (message: string) => void;
}

export function createWizardScene(
  canvas: HTMLCanvasElement,
  options: WizardSceneOptions = {},
): WizardSceneHandle {
  const app = new pc.Application(canvas, {
    mouse: new pc.Mouse(canvas),
    touch: new pc.TouchDevice(canvas),
    keyboard: new pc.Keyboard(window),
    graphicsDeviceOptions: { antialias: true },
  });

  // Fill whatever space the canvas element is given (the visualizer page
  // sizes that element to the full viewport) rather than letterboxing to a
  // fixed aspect ratio.
  app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
  app.setCanvasResolution(pc.RESOLUTION_AUTO);

  // RESOLUTION_AUTO sizes the render target to the canvas's CSS pixels, not
  // physical pixels, so HiDPI/retina displays render soft otherwise.
  app.graphicsDevice.maxPixelRatio = window.devicePixelRatio;

  const handleResize = () => app.resizeCanvas();
  window.addEventListener("resize", handleResize);

  app.start();

  // Ambient and skybox light reach surfaces regardless of occlusion, so
  // these set the floor on how dark any shadow can get.
  app.scene.ambientLight = new pc.Color(...AMBIENT.color);
  app.scene.skyboxIntensity = AMBIENT.skyboxIntensity;
  app.scene.exposure = AMBIENT.exposure;

  const skyEntity = new pc.Entity("Sky");
  app.root.addChild(skyEntity);
  skyEntity.addComponent("script");
  skyEntity.script!.create(ProceduralSky, { properties: { ...SKY } });

  const sceneAsset = new pc.Asset("scene", "container", {
    url: WIZARD_TABLE_MODEL_URL,
  });

  // PlayCanvas drops glTF `extras`, so capture the raw JSON as it parses to
  // read the Blender custom properties back out. Runs before `ready` fires.
  let extras: GltfExtrasIndex = emptyGltfExtrasIndex();
  sceneAsset.options = {
    global: {
      postprocess: (gltf: unknown) => {
        extras = indexGltfExtras(gltf);
      },
    },
  };

  app.assets.add(sceneAsset);
  app.assets.load(sceneAsset);

  options.onLoading?.(true);

  sceneAsset.ready(() => {
    const container = sceneAsset.resource as pc.ContainerResource;
    const entity = container.instantiateRenderEntity();
    app.root.addChild(entity);

    // Before anything animates: bind matrices are read from the rest pose.
    entity.findComponents("render").forEach((component) => {
      isolateSkin(component as pc.RenderComponent, app.graphicsDevice);
    });

    // Play every animation exported with the glTF (e.g. the torch flame
    // flicker, a camera pan) on a continuous, looping default state. Each
    // clip gets its own anim layer — assignAnimation only auto-plays the
    // first clip it's given, since later calls land on an existing layer
    // instead of getting a fresh default-autoplay state. addAnimationState
    // with a distinct layerName per clip sidesteps that, so every clip
    // starts playing independently regardless of how many there are.
    const animationAssets = (container as unknown as { animations?: pc.Asset[] })
      .animations;
    if (animationAssets && animationAssets.length > 0) {
      entity.addComponent("anim");
      animationAssets.forEach((asset, index) => {
        const track = asset.resource as pc.AnimTrack;
        const name = track.name || `clip-${index}`;
        const loop = extrasBoolean(extras.animation(name), "loop", true);
        entity.anim!.addAnimationState(name, track, 1, loop, name);
      });
    }

    entity.findComponents("light").forEach((component) => {
      const light = component as pc.LightComponent;
      light.enabled = true;
      // The imported light intensities/colors don't match how they looked in
      // Blender, so drive them from config.ts instead (see LIGHTING.scale).
      if (light.type === "omni") {
        const torchName = findTorchRootName(light.entity as pc.Entity);
        const override = (torchName && TORCH_OVERRIDES[torchName]) || {};
        const settings = { ...DEFAULT_TORCH, ...override };

        light.intensity =
          LIGHTING.torchIntensity * LIGHTING.scale * settings.brightnessMultiplier;
        if (settings.color) light.color = new pc.Color(...settings.color);
        light.castShadows = settings.castShadows;
      }
      if (light.type === "spot") {
        light.intensity = LIGHTING.overheadIntensity * LIGHTING.scale;
        if (OVERHEAD_LIGHT.color) light.color = new pc.Color(...OVERHEAD_LIGHT.color);
        light.castShadows = OVERHEAD_LIGHT.castShadows;
      }
      if (light.castShadows) {
        light.shadowResolution = SHADOWS.resolution;
        light.normalOffsetBias = SHADOWS.normalOffsetBias;
        light.shadowBias = SHADOWS.shadowBias;
        light.shadowIntensity = SHADOWS.intensity;
        light.shadowType = SHADOW_TYPES[SHADOWS.type];

        if (SHADOWS.type === "soft") {
          light.shadowSamples = SHADOWS.samples;
          light.shadowBlockerSamples = SHADOWS.blockerSamples;
          light.penumbraSize = SHADOWS.penumbraSize;
          light.penumbraFalloff = SHADOWS.penumbraFalloff;
        }
      }
    });

    // Chairs, table, and cards cast shadows onto each other; the ground
    // plane only needs to receive them.
    entity.findComponents("render").forEach((component) => {
      const render = component as pc.RenderComponent;
      if (SHADOW_CASTER_NAME_RE.test(render.entity.name)) {
        render.castShadows = true;
        render.receiveShadows = true;
      } else if (render.entity.name === GROUND_PLANE_NAME) {
        render.receiveShadows = true;
      }
    });


    // Use the camera baked into the glTF scene, if present.
    let camera = entity.findComponent("camera") as pc.CameraComponent | null;
    if (camera) {
      camera.enabled = true;
      lockVerticalFov(camera);
    } else {
      const fallbackCamera = new pc.Entity("FallbackCamera");
      fallbackCamera.addComponent("camera", {
        clearColor: new pc.Color(0.05, 0.05, 0.08),
      });
      fallbackCamera.setPosition(0, 2, 5);
      fallbackCamera.lookAt(0, 0, 0);
      app.root.addChild(fallbackCamera);
      camera = fallbackCamera.camera!;
    }

    camera.entity.addComponent("script");
    camera.entity.script!.create(CameraControls, {
      properties: {
        focusPoint: new pc.Vec3(0, 1, 0),
        enableFly: false,
        enablePan: true,
        zoomRange: new pc.Vec2(1, 40),
        pitchRange: new pc.Vec2(-85, 85),
      },
    });

    options.onLoading?.(false);
  });

  sceneAsset.on("error", (err: string) => {
    options.onError?.(`Failed to load scene: ${err}`);
  });

  const destroy = () => {
    window.removeEventListener("resize", handleResize);
    app.destroy();
  };

  return { app, destroy };
}
