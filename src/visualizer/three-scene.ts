import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { ANIMATION, CAMERA, DEV, RENDER } from "./config";
import {
  configureRenderer,
  createAmbientLight,
  prepareEnvironment,
} from "./environment-setup";
import { loadTableScene } from "./table-scene-asset";
import { createTorchSparks, type TorchSparks } from "./torch-sparks";
import { createCameraFollow, type CameraFollow } from "./camera-follow";
import {
  createPlayerCharacters,
  CHARACTER_IDS,
  CLIP_NAMES,
  SEAT_IDS,
  type PlayerCharacters,
  type SeatId,
} from "./player-characters";


export interface WizardSceneHandle {
  destroy: () => void;
}

// What the page needs from the scene to handle pointer input on it.
export interface SceneView {
  camera: THREE.Camera;
  canvas: HTMLCanvasElement;
  // The table's renderer, for other drawing that should reuse what it already
  // holds on the GPU, such as headshots.
  renderer: THREE.WebGLRenderer;
  // Keeps the orbit controls from reacting while true, e.g. during a card drag.
  holdOrbit(held: boolean): void;
  // Runs once the intro camera move has finished; straight away if it has.
  whenIntroDone(callback: () => void): void;
  // Turns the camera toward a point in the world, or back to its normal view
  // with null. A change of point switches orbit controls off.
  // onArrive: called once the camera has finished turning there.
  lookToward(point: THREE.Vector3 | null, onArrive?: () => void): void;
}

export interface WizardSceneOptions {
  onLoading?: (loading: boolean) => void;
  onError?: (message: string) => void;
  // Fill the table with one of each character. For working on the scene
  // without a game; a live game seats its real players instead.
  demo?: boolean;
  // Called once the environment is loaded and characters can be seated.
  onReady?: (
    players: PlayerCharacters,
    environment: THREE.Object3D,
    view: SceneView,
  ) => void;
  // Called every frame with the elapsed seconds, before characters animate.
  onUpdate?: (deltaSeconds: number) => void;
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
  configureRenderer(renderer);

  const scene = new THREE.Scene();
  scene.add(createAmbientLight());

  // Replaced once the glTF's own camera is found.
  let camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  camera.position.set(0, 6, 12);

  let controls: OrbitControls | null = null;
  // Orbit controls start as CAMERA.orbitControls says and the O key toggles
  // them. Something else, like a card drag, can hold them off meanwhile.
  let orbitOn = CAMERA.orbitControls;
  let orbitHeld = false;
  // Turns the camera toward whoever's turn it is while orbit controls are off.
  let follow: CameraFollow | null = null;
  let lookingAt: THREE.Vector3 | null = null;
  let introDone = false;
  const introWaiters: Array<() => void> = [];
  // The intro camera move has finished, or there wasn't one.
  const finishIntro = () => {
    if (introDone) return;
    introDone = true;
    follow?.captureRest();
    console.info("[camera] intro finished");
    for (const waiter of introWaiters.splice(0)) waiter();
  };
  // How far ahead of the camera the orbit target sits: the table's distance.
  let orbitDistance = 10;
  const applyOrbit = () => {
    if (!controls) return;
    const active = orbitOn && !orbitHeld;
    if (active && !controls.enabled) {
      // Orbit from wherever the camera is looking now, so nothing jumps.
      controls.target
        .copy(camera.position)
        .addScaledVector(camera.getWorldDirection(new THREE.Vector3()), orbitDistance);
    }
    controls.enabled = active;
  };
  const onOrbitKey = (event: KeyboardEvent) => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key.toLowerCase() !== "o") return;
    orbitOn = !orbitOn;
    applyOrbit();
    console.info(`[camera] orbit controls ${orbitOn ? "on" : "off"}`);
  };
  window.addEventListener("keydown", onOrbitKey);
  let mixer: THREE.AnimationMixer | null = null;
  let sparks: TorchSparks | null = null;
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
    orbitDistance = camera.position.distanceTo(focus);
    controls.target.copy(camera.position).addScaledVector(forward, orbitDistance);
    controls.enablePan = true;
    controls.minDistance = CAMERA.minDistance;
    controls.maxDistance = CAMERA.maxDistance;
    controls.update();
    applyOrbit();
  };

  options.onLoading?.(true);

  loadTableScene()
    .then((gltf) => {
      if (disposed) return;
      scene.add(gltf.scene);

      // glTF cameras come through as children of the scene graph.
      const gltfCamera = gltf.cameras[0] as THREE.PerspectiveCamera | undefined;
      if (gltfCamera) camera = gltfCamera;
      resize();
      follow = createCameraFollow(camera);

      prepareEnvironment(gltf.scene);
      sparks = createTorchSparks(gltf.scene);

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

      // Controls are set up once the intro camera move ends, whether or not
      // they start switched on; the O key toggles them.
      const intro = introCamera as THREE.AnimationAction | null;
      if (!intro || !mixer) {
        finishIntro();
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
          finishIntro();
          enableOrbit(gltf.scene);
        };
        envMixer.addEventListener("finished", onFinished);
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

      // Demo table: one of each character. In dev, "." moves everyone round a
      // seat (rotation 1..6, wrapping) so every character can be checked in
      // every chair — there are six characters but only five seats.
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
      if (options.demo) seatCharacters();

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

      if (import.meta.env.DEV && DEV.demoControls) {
        onKeyDown = (event) => {
          if (event.repeat) return;
          if (event.key === "." && options.demo) {
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

      options.onReady?.(seatPlayers, gltf.scene, {
        camera,
        canvas: renderer.domElement,
        renderer,
        holdOrbit: (held) => {
          orbitHeld = held;
          applyOrbit();
        },
        whenIntroDone: (callback) => {
          if (introDone) callback();
          else introWaiters.push(callback);
        },
        lookToward: (point, onArrive) => {
          const changed = point === null ? lookingAt !== null : !lookingAt?.equals(point);
          lookingAt = point ? point.clone() : null;
          // Orbit controls are for testing: when the turn moves the camera,
          // it takes the camera back from them.
          if (changed && orbitOn) {
            orbitOn = false;
            applyOrbit();
            console.info("[camera] orbit controls off: following the turn");
          }
          if (follow) follow.setTarget(point, onArrive);
          else onArrive?.();
        },
      });

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
    })
    .catch((err) => options.onError?.(`Failed to load scene: ${err}`));

  let frame = 0;
  let last = performance.now();
  const tick = () => {
    frame = requestAnimationFrame(tick);
    const now = performance.now();
    const dt = (now - last) / 1000;
    last = now;
    mixer?.update(dt);
    sparks?.update(dt);
    options.onUpdate?.(dt);
    players?.update(dt);
    // Orbit controls drive the camera while they're on; otherwise, once the
    // intro has played, it follows the turn.
    if (controls?.enabled) controls.update();
    else if (introDone) follow?.update(dt);
    renderer.render(scene, camera);
  };
  resize();
  tick();

  return {
    destroy: () => {
      disposed = true;
      introWaiters.length = 0;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onOrbitKey);
      if (onKeyDown) window.removeEventListener("keydown", onKeyDown);
      controls?.dispose();
      players?.dispose();
      players = null;
      sparks?.dispose();
      renderer.dispose();
      // Releases every GPU resource of this context at once; browsers cap
      // live WebGL contexts, so repeated navigation would otherwise run out.
      renderer.forceContextLoss();
    },
  };
}
