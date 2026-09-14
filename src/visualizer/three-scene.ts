import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  LIGHTING,
  SHADOWS,
  AMBIENT,
  OVERHEAD_LIGHT,
  DEFAULT_TORCH,
  ANIMATION,
  CAMERA,
  RENDER,
  TORCH_OVERRIDES,
} from "./config";
import {
  createPlayerCharacters,
  CHARACTER_IDS,
  CLIP_NAMES,
  SEAT_IDS,
  type PlayerCharacters,
  type SeatId,
} from "./player-characters";

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
const WIZARD_TABLE_MODEL_URL = "/models/wizard/Wizard.glb";

export interface WizardSceneHandle {
  destroy: () => void;
}

export interface WizardSceneOptions {
  onLoading?: (loading: boolean) => void;
  onError?: (message: string) => void;
}

// Walk up from a torch's light to its collection-instance root ("torch.003"),
// which is what TORCH_OVERRIDES is keyed by.
function findTorchRootName(object: THREE.Object3D | null): string | null {
  for (let o = object; o; o = o.parent) {
    const name = canonicalName(o.name);
    if (TORCH_NAME_RE.test(name)) return name;
  }
  return null;
}

// Blender writes custom properties into glTF `extras`; GLTFLoader surfaces
// them as userData. Numeric props arrive as 0/1 rather than booleans.
function extrasBoolean(
  userData: Record<string, unknown> | undefined,
  key: string,
  fallback: boolean,
): boolean {
  const value = userData?.[key];
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    if (value === "0" || value.toLowerCase() === "false") return false;
    if (value === "1" || value.toLowerCase() === "true") return true;
  }
  return fallback;
}

export function createWizardScene(
  canvas: HTMLCanvasElement,
  options: WizardSceneOptions = {},
): WizardSceneHandle {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = {
    hard: THREE.BasicShadowMap,
    pcf: THREE.PCFShadowMap,
    soft: THREE.VSMShadowMap,
  }[SHADOWS.type];
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = AMBIENT.exposure;

  const scene = new THREE.Scene();
  scene.add(
    new THREE.AmbientLight(new THREE.Color(...AMBIENT.color), AMBIENT.intensity),
  );

  // Replaced once the glTF's own camera is found.
  let camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  camera.position.set(0, 6, 12);

  let controls: OrbitControls | null = null;
  let mixer: THREE.AnimationMixer | null = null;
  let players: PlayerCharacters | null = null;
  let onKeyDown: ((event: KeyboardEvent) => void) | null = null;
  // The environment can finish loading after navigation has torn this down.
  let disposed = false;

  const resize = () => {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    // Cap the drawing buffer: a 4K panel otherwise costs 4x a 1080p one for
    // the same view. Below 1 this renders smaller than the canvas and the
    // browser scales it up.
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, RENDER.maxPixelRatio, RENDER.maxHeight / h),
    );
    renderer.setSize(w, h, false);
    // Vertical FOV stays as authored; horizontal widens or narrows with the
    // window, and matching aspect to the canvas avoids any stretching.
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  window.addEventListener("resize", resize);

  // Hands the camera to the mouse without a jump: OrbitControls re-aims the
  // camera at its target on every update, so the target goes on the camera's
  // current line of sight, at the table's distance, keeping the framing.
  const enableOrbit = (environment: THREE.Object3D) => {
    const forward = camera.getWorldDirection(new THREE.Vector3());
    const table = environment.getObjectByName("table-top");
    const focus = table
      ? new THREE.Box3().setFromObject(table).getCenter(new THREE.Vector3())
      : new THREE.Vector3(...CAMERA.target);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target
      .copy(camera.position)
      .addScaledVector(forward, camera.position.distanceTo(focus));
    controls.enablePan = true;
    controls.minDistance = CAMERA.minDistance;
    controls.maxDistance = CAMERA.maxDistance;
    controls.update();
  };

  options.onLoading?.(true);

  new GLTFLoader().load(
    WIZARD_TABLE_MODEL_URL,
    (gltf) => {
      if (disposed) return;
      scene.add(gltf.scene);

      // glTF cameras come through as children of the scene graph.
      const gltfCamera = gltf.cameras[0] as THREE.PerspectiveCamera | undefined;
      if (gltfCamera) camera = gltfCamera;
      resize();

      gltf.scene.traverse((object) => {
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
            light.castShadow = settings.castShadows;
            (light as THREE.PointLight).decay = LIGHTING.falloff;
          }
          if ((light as THREE.SpotLight).isSpotLight) {
            (light as THREE.SpotLight).decay = LIGHTING.falloff;
            light.intensity = LIGHTING.overheadIntensity * LIGHTING.scale;
            if (OVERHEAD_LIGHT.color) {
              light.color = new THREE.Color(...OVERHEAD_LIGHT.color);
            }
            light.castShadow = OVERHEAD_LIGHT.castShadows;
          }
          // Only the shadow-casting light types carry a `shadow`.
          const caster = light as THREE.PointLight | THREE.SpotLight;
          if (caster.castShadow && caster.shadow) {
            caster.shadow.mapSize.set(SHADOWS.resolution, SHADOWS.resolution);
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
            mesh.castShadow = true;
            mesh.receiveShadow = true;
          } else if (mesh.name === GROUND_PLANE_NAME) {
            mesh.receiveShadow = true;
          }
        }
      });

      // Environment clips only (camera move, torch flicker): characters are
      // separate assets with their own mixers. Every clip here plays at once
      // and loops, except where a Blender custom property says otherwise.
      let introCamera: THREE.AnimationAction | null = null;
      if (gltf.animations.length) {
        mixer = new THREE.AnimationMixer(gltf.scene);
        mixer.timeScale = ANIMATION.timeScale;
        for (const clip of gltf.animations) {
          const action = mixer.clipAction(clip);
          const target = gltf.scene.getObjectByName(
            clip.tracks[0]?.name.split(".")[0] ?? "",
          );
          const loop = extrasBoolean(target?.userData, "loop", true);
          if (!loop) {
            action.setLoop(THREE.LoopOnce, 1);
            action.clampWhenFinished = true;
            for (let o: THREE.Object3D | null = camera; o; o = o.parent) {
              if (o === target) introCamera = action;
            }
          }
          action.play();
        }
      }

      if (CAMERA.orbitControls) {
        const intro = introCamera as THREE.AnimationAction | null;
        if (!intro || !mixer) {
          enableOrbit(gltf.scene);
        } else {
          const envMixer = mixer;
          const onFinished = (event: { action: THREE.AnimationAction }) => {
            if (event.action !== intro) return;
            envMixer.removeEventListener("finished", onFinished);
            // A clamped action keeps writing its last pose every frame, which
            // would override the controls; but stopping it restores the
            // camera's pre-animation pose. Keep the final framing across it.
            const position = camera.position.clone();
            const quaternion = camera.quaternion.clone();
            intro.stop();
            camera.position.copy(position);
            camera.quaternion.copy(quaternion);
            enableOrbit(gltf.scene);
          };
          envMixer.addEventListener("finished", onFinished);
        }
      }

      const seats = new Map<SeatId, THREE.Object3D>();
      gltf.scene.traverse((object) => {
        const id = Number(
          object.userData.seat_id ?? /^seat(\d)$/.exec(object.name)?.[1],
        );
        if ((SEAT_IDS as readonly number[]).includes(id)) {
          seats.set(id as SeatId, object);
        }
      });

      players = createPlayerCharacters(seats);
      const seatPlayers = players;
      // One of each character. In dev, "." moves everyone round a seat
      // (rotation 1..6, wrapping) so every character can be checked in every
      // chair — there are six characters but only five seats.
      let rotation = 1;
      const seatCharacters = () => {
        const assignment = SEAT_IDS.map((seat, i) => {
          const character =
            CHARACTER_IDS[(i + rotation - 1) % CHARACTER_IDS.length];
          seatPlayers
            .setCharacter(seat, character)
            .catch((err) => console.warn(`[players] seat ${seat}:`, err));
          return `seat${seat}=${character}`;
        });
        console.info(
          `[players] rotation ${rotation}/${CHARACTER_IDS.length}: ${assignment.join(" ")}`,
        );
      };
      seatCharacters();

      // Everyone idles by default. In dev, "/" steps through the clips:
      // rotation 0 is all idle, 1..6 give each seat a different clip, then
      // it wraps back to all idle.
      let clipRotation = 0;
      const assignClips = () => {
        const assignment = SEAT_IDS.map((seat, i) => {
          const clip =
            clipRotation === 0
              ? "idle"
              : CLIP_NAMES[(i + clipRotation - 1) % CLIP_NAMES.length];
          seatPlayers.loopClip(seat, clip);
          return `seat${seat}=${clip}`;
        });
        console.info(
          `[players] clips ${clipRotation}/${CLIP_NAMES.length}: ${assignment.join(" ")}`,
        );
      };
      assignClips();

      if (import.meta.env.DEV) {
        onKeyDown = (event) => {
          if (event.repeat) return;
          if (event.key === ".") {
            rotation = (rotation % CHARACTER_IDS.length) + 1;
            seatCharacters();
          } else if (event.key === "/") {
            event.preventDefault(); // "/" opens quick find in Firefox
            clipRotation = (clipRotation + 1) % (CLIP_NAMES.length + 1);
            assignClips();
          }
        };
        window.addEventListener("keydown", onKeyDown);
      }

      if (import.meta.env.DEV) {
        (window as unknown as Record<string, unknown>).__wizard = {
          scene,
          camera,
          renderer,
          gltf,
          players,
          THREE,
        };
      }

      options.onLoading?.(false);
    },
    undefined,
    (err) => options.onError?.(`Failed to load scene: ${err}`),
  );

  let frame = 0;
  let last = performance.now();
  const tick = () => {
    frame = requestAnimationFrame(tick);
    const now = performance.now();
    const dt = (now - last) / 1000;
    last = now;
    mixer?.update(dt);
    players?.update(dt);
    controls?.update();
    renderer.render(scene, camera);
  };
  resize();
  tick();

  return {
    destroy: () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      if (onKeyDown) window.removeEventListener("keydown", onKeyDown);
      controls?.dispose();
      players?.dispose();
      players = null;
      renderer.dispose();
      // Releases every GPU resource of this context at once; browsers cap
      // live WebGL contexts, so repeated navigation would otherwise run out.
      renderer.forceContextLoss();
    },
  };
}
