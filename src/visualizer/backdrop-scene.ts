import * as THREE from "three";
import { ANIMATION, BACKDROP, RENDER } from "./config";
import {
  configureRenderer,
  createAmbientLight,
  prepareEnvironment,
} from "./environment-setup";
import { loadTableScene } from "./table-scene-asset";
import { createTorchSparks, type TorchSparks } from "./torch-sparks";
import { maxPixelRatio } from "./device-limits";

export interface BackdropScene {
  dispose(): void;
}

// Card targets baked into Wizard.glb: the hand, trick, trump and stack slots.
const CARD_NODE_RE = /^(card\d+|card-mesh|played-card-\d+|trump-card|stack-card-\d+)$/;
const TABLE_TOP_NAME = "table-top";

// The table scene as a full-window background for the pages around the game:
// no characters, no cards, and instead of the game's intro camera move, a slow
// circle of the table, always looking at it. See BACKDROP in config.ts.
export function createBackdropScene(parent: HTMLElement): BackdropScene {
  const canvas = document.createElement("canvas");
  canvas.className = "backdrop-canvas";
  canvas.setAttribute("aria-hidden", "true");
  parent.prepend(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  configureRenderer(renderer);
  renderer.shadowMap.enabled = BACKDROP.shadows;

  const scene = new THREE.Scene();
  scene.add(createAmbientLight());
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  const target = new THREE.Vector3();
  let mixer: THREE.AnimationMixer | null = null;
  let sparks: TorchSparks | null = null;
  let disposed = false;

  const resize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio(), RENDER.maxHeight / height));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  window.addEventListener("resize", resize);
  resize();

  // A phone short of graphics memory takes the context away, and without this
  // the canvas stays blank for the rest of the visit: a white page under the
  // menus, with no error, since the backdrop is decoration and nothing watches
  // it. Calling preventDefault is what lets the browser hand a context back.
  //
  // The scene is not rebuilt here. Whatever ran the device out of memory is
  // still there, and rebuilding immediately tends to lose the context again a
  // second later; the browser also restores nothing while the tab is hidden.
  // So the canvas is hidden on loss, and one restore is taken if it comes.
  let contextLost = false;
  const onContextLost = (event: Event) => {
    event.preventDefault();
    contextLost = true;
    canvas.style.display = "none";
    console.warn("[backdrop] the graphics context was lost; the pages carry on without it");
  };
  const onContextRestored = () => {
    contextLost = false;
    canvas.style.display = "";
    // Everything on the GPU went with the context; three re-uploads what the
    // scene still references on the next frame.
    resize();
    console.info("[backdrop] the graphics context came back");
  };
  canvas.addEventListener("webglcontextlost", onContextLost);
  canvas.addEventListener("webglcontextrestored", onContextRestored);

  loadTableScene()
    .then((gltf) => {
      if (disposed) return;
      prepareEnvironment(gltf.scene);
      sparks = createTorchSparks(gltf.scene);
      gltf.scene.traverse((object) => {
        if (CARD_NODE_RE.test(object.name)) object.visible = false;
      });
      scene.add(gltf.scene);

      // The exported camera's lens, without its animation.
      const exported = gltf.cameras[0] as THREE.PerspectiveCamera | undefined;
      if (exported) {
        camera.fov = exported.fov;
        camera.near = exported.near;
        camera.far = exported.far;
        camera.updateProjectionMatrix();
      }

      const tableTop = gltf.scene.getObjectByName(TABLE_TOP_NAME);
      if (tableTop) new THREE.Box3().setFromObject(tableTop).getCenter(target);

      // Everything but the camera move plays as in the game, e.g. torch flicker.
      const cameraNodes = new Set<string>();
      for (let node: THREE.Object3D | null = exported ?? null; node; node = node.parent) cameraNodes.add(node.name);
      const clips = gltf.animations.filter(
        (clip) => !clip.tracks.some((track) => cameraNodes.has(track.name.split(".")[0] ?? "")),
      );
      if (clips.length) {
        mixer = new THREE.AnimationMixer(gltf.scene);
        mixer.timeScale = ANIMATION.timeScale;
        for (const clip of clips) mixer.clipAction(clip).play();
      }
    })
    .catch((error) => console.warn("[backdrop] could not load the table scene:", error));

  // Level distance out from the table, so the camera is BACKDROP.radius away.
  const across = Math.sqrt(Math.max(BACKDROP.radius ** 2 - BACKDROP.height ** 2, 0));
  let angle = THREE.MathUtils.degToRad(BACKDROP.startDegrees);
  let frame = 0;
  let last = performance.now();
  const tick = () => {
    frame = requestAnimationFrame(tick);
    const now = performance.now();
    // Real time, so a slow device still circles once per secondsPerTurn; only
    // long gaps (a hidden tab, a stall) are skipped rather than jumped over.
    const elapsed = (now - last) / 1000;
    const deltaSeconds = elapsed > 1 ? 0 : elapsed;
    last = now;
    if (document.hidden || contextLost) return;

    angle += (deltaSeconds / BACKDROP.secondsPerTurn) * Math.PI * 2;
    camera.position.set(
      target.x + Math.sin(angle) * across,
      target.y + BACKDROP.height,
      target.z + Math.cos(angle) * across,
    );
    camera.lookAt(target);
    mixer?.update(deltaSeconds);
    sparks?.update(deltaSeconds);
    renderer.render(scene, camera);
  };
  tick();

  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__backdrop = { scene, camera, renderer };

  return {
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      mixer?.stopAllAction();
      sparks?.dispose();
      renderer.dispose();
      // Frees this context's GPU memory at once; the 3D view needs its own.
      renderer.forceContextLoss();
      canvas.remove();
      if (import.meta.env.DEV) delete (window as unknown as Record<string, unknown>).__backdrop;
    },
  };
}
