import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { createCharacterAnimator, type CharacterAnimator } from "./character-animator";
import { loadCharacterAsset, type CharacterId } from "./character-assets";
import { SELF_PORTRAIT } from "./config";
import type { Emote } from "./player-characters";
import { frameCharacter } from "./portrait";

export interface SelfPortrait {
  setCharacter(character: CharacterId): void;
  emote(emote: Emote): void;
  // Development aid: what's showing and its animation state.
  debug(): {
    character: CharacterId | null;
    emote: string | null;
    animator: CharacterAnimator | null;
  };
  destroy(): void;
}

// The local player's own character, front-on in a small corner view, so they
// can watch the emotes they trigger. Their chair at the table holds the camera,
// so this is the only place they appear. Its own small canvas keeps it
// independent of the table's renderer, shadows and resolution cap.
export function createSelfPortrait(view: HTMLElement): SelfPortrait {
  const canvas = document.createElement("canvas");
  view.append(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const key = new THREE.DirectionalLight(0xffffff, SELF_PORTRAIT.keyLightIntensity);
  scene.add(new THREE.AmbientLight(0xffffff, SELF_PORTRAIT.ambientIntensity), key, key.target);
  const camera = new THREE.PerspectiveCamera(SELF_PORTRAIT.fov, 1, 0.01, 100);

  let character: CharacterId | null = null;
  let model: THREE.Object3D | null = null;
  let animator: CharacterAnimator | null = null;
  let destroyed = false;

  const removeModel = () => {
    animator?.dispose();
    animator = null;
    if (!model) return;
    model.removeFromParent();
    // Skeletons are per clone; geometry and textures belong to the cache.
    model.traverse((child) => {
      const mesh = child as THREE.SkinnedMesh;
      if (mesh.isSkinnedMesh) mesh.skeleton.dispose();
    });
    model = null;
  };

  const resize = () => {
    const width = view.clientWidth;
    const height = view.clientHeight;
    if (!width || !height) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, SELF_PORTRAIT.maxPixelRatio));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(view);
  resize();

  let frame = 0;
  let last = performance.now();
  let pending = 0;
  const tick = () => {
    frame = requestAnimationFrame(tick);
    const now = performance.now();
    // Clamp so a long pause doesn't fast-forward an emote.
    pending = Math.min(pending + (now - last) / 1000, 0.1);
    last = now;
    if (pending < 1 / SELF_PORTRAIT.targetFps || document.hidden) return;
    animator?.update(pending);
    pending = 0;
    if (model) renderer.render(scene, camera);
  };
  tick();

  return {
    setCharacter(next) {
      if (destroyed || next === character) return;
      character = next;

      loadCharacterAsset(next)
        .then((asset) => {
          if (destroyed || character !== next) return;
          removeModel();

          const root = cloneSkinned(asset.template);
          scene.add(root);
          const nextAnimator = createCharacterAnimator(root, asset.clips, next);
          nextAnimator.playLoop("idle");

          // Frame from the idle's first pose, as the picker does, then resume
          // from its random phase.
          const idle = nextAnimator.actions().idle;
          const phase = idle?.time ?? 0;
          if (idle) idle.time = 0;
          nextAnimator.update(0);
          frameCharacter(camera, key, root, SELF_PORTRAIT);
          if (idle) idle.time = phase;

          model = root;
          animator = nextAnimator;
        })
        .catch((error) => {
          console.warn(`[self-portrait] could not load ${next}:`, error);
          // Allow a later attempt at the same character.
          if (character === next) character = null;
        });
    },

    emote(emote) {
      animator?.playOnce(emote);
    },

    debug() {
      return { character: animator ? character : null, emote: animator?.emote ?? null, animator };
    },

    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      removeModel();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
