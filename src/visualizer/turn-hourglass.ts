import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import hourglassModel from "../assets/models/wizard/hourglass.glb?url";
import { TURN_HOURGLASS } from "./config";
import {
  finishTimeline,
  poseAt,
  retimeTimeline,
  RUN_OUT,
  startTimeline,
  stepWeights,
  timelineDone,
  type HourglassPose,
  type HourglassTimeline,
} from "./hourglass-motion";

export interface TurnHourglass {
  // A turn starts: flip, settle, then drain, all inside seconds.
  startTurn(seconds: number): void;
  // The time now runs out secondsLeft from now: the rest of the sand drains by
  // then, from where it is.
  retime(secondsLeft: number): void;
  // The move was made: the sand left runs out quickly.
  finishTurn(): void;
  destroy(): void;
}

interface HourglassParts {
  root: THREE.Object3D;
  flip: THREE.Object3D;
  sand: THREE.Mesh;
  drainKeys: number[]; // morph target indices, drain1 .. drainN
  clearKeys: number[];
  settleKeys: number[];
}

// The shape keys named name1, name2, ... in order.
const keyChain = (sand: THREE.Mesh, name: string): number[] => {
  const dictionary = sand.morphTargetDictionary ?? {};
  const chain: number[] = [];
  for (let k = 1; dictionary[`${name}${k}`] !== undefined; k++) {
    chain.push(dictionary[`${name}${k}`]);
  }
  return chain;
};

const loadHourglass = async (): Promise<HourglassParts> => {
  const gltf = await new GLTFLoader().loadAsync(hourglassModel);
  const flip = gltf.scene.getObjectByName("Flip");
  const sand = gltf.scene.getObjectByName("Sand") as THREE.Mesh | undefined;
  if (!flip || !sand?.morphTargetInfluences) {
    throw new Error("hourglass.glb has no Flip pivot or Sand shape keys");
  }
  return {
    root: gltf.scene,
    flip,
    sand,
    drainKeys: keyChain(sand, "drain"),
    clearKeys: keyChain(sand, "clear"),
    settleKeys: keyChain(sand, "settle"),
  };
};

const applyPose = (parts: HourglassParts, pose: HourglassPose) => {
  // Blender's y axis, the flip's, is -z here.
  parts.flip.rotation.z = -Math.PI * pose.turn;
  const influences = parts.sand.morphTargetInfluences!;
  stepWeights(pose.drain, parts.drainKeys.length).forEach((weight, k) => {
    influences[parts.drainKeys[k]] = weight;
  });
  stepWeights(pose.clear, parts.clearKeys.length).forEach((weight, k) => {
    influences[parts.clearKeys[k]] = weight;
  });
  // The settle keys run backwards: all at 0 is settled.
  stepWeights(1 - pose.settle, parts.settleKeys.length).forEach((weight, k) => {
    influences[parts.settleKeys[k]] = weight;
  });
};

// The hourglass that times a human player's move, in a small canvas of its
// own under Leave Table. It sits run out between turns; each turn it flips,
// the sand settles, drains and clears, so it runs out as the time does.
// Drawn only while it moves.
export function createTurnHourglass(view: HTMLElement): TurnHourglass {
  const canvas = document.createElement("canvas");
  view.append(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const key = new THREE.DirectionalLight(0xffffff, TURN_HOURGLASS.keyLightIntensity);
  key.position.set(1, 2, 3);
  scene.add(new THREE.AmbientLight(0xffffff, TURN_HOURGLASS.ambientIntensity), key);
  const camera = new THREE.PerspectiveCamera(TURN_HOURGLASS.fov, 1, 0.01, 20);

  let parts: HourglassParts | null = null;
  let timeline: HourglassTimeline | null = null;
  let destroyed = false;
  let dirty = true;

  const clock = () => performance.now() / 1000;

  const resize = () => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio * TURN_HOURGLASS.supersample, TURN_HOURGLASS.maxPixelRatio),
    );
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    dirty = true;
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();

  // Aimed at the flip's pivot, from far enough that the hourglass fits
  // whichever way up it is.
  const frame = (flip: THREE.Object3D) => {
    const centre = flip.getWorldPosition(new THREE.Vector3());
    const halfFov = THREE.MathUtils.degToRad(TURN_HOURGLASS.fov / 2);
    const distance = TURN_HOURGLASS.fitRadius / Math.sin(halfFov);
    const elevation = THREE.MathUtils.degToRad(TURN_HOURGLASS.elevationDegrees);
    camera.position.set(
      centre.x,
      centre.y + Math.sin(elevation) * distance,
      centre.z + Math.cos(elevation) * distance,
    );
    camera.lookAt(centre);
  };

  loadHourglass()
    .then((loaded) => {
      if (destroyed) return;
      scene.add(loaded.root);
      loaded.root.updateMatrixWorld(true);
      frame(loaded.flip);
      parts = loaded;
      dirty = true;
    })
    .catch((error) => console.warn("[hourglass] could not load:", error));

  let animationFrame = 0;
  let last = performance.now();
  let pending = 0;
  const tick = () => {
    animationFrame = requestAnimationFrame(tick);
    const now = performance.now();
    pending += (now - last) / 1000;
    last = now;
    if (pending < 1 / TURN_HOURGLASS.targetFps || document.hidden) return;
    pending = 0;
    if (!parts) return;

    const time = clock();
    const moving = timeline !== null && !timelineDone(timeline, time);
    if (!moving && !dirty) return;
    applyPose(parts, timeline ? poseAt(timeline, time) : RUN_OUT);
    if (timeline && !moving) timeline = null; // run out: rest until the next turn
    dirty = false;
    renderer.render(scene, camera);
  };
  tick();

  return {
    startTurn(seconds) {
      timeline = startTimeline(clock(), seconds, TURN_HOURGLASS);
    },

    retime(secondsLeft) {
      if (timeline) timeline = retimeTimeline(timeline, clock(), clock() + secondsLeft);
    },

    finishTurn() {
      if (timeline) timeline = finishTimeline(timeline, clock(), TURN_HOURGLASS.finishSeconds);
    },

    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      scene.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((material) =>
          material.dispose(),
        );
      });
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
