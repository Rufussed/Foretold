import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import {
  CHARACTER_IDS,
  loadCharacterAsset,
  type CharacterId,
} from "./character-assets";
import { ANIMATION, AVATAR_PICKER } from "./config";
import { frameCharacter } from "./portrait";

export const CHARACTER_LABELS: Record<CharacterId, string> = {
  "forest-elf": "Forest Elf",
  "blind-wizard": "Blind Wizard",
  "black-witch": "Black Witch",
  "kungfu-girl": "Kung Fu Girl",
  goatman: "Goatman",
  demon: "Demon",
};

export interface AvatarPickerOptions {
  onSelect(avatar: CharacterId): void;
}

export interface AvatarPicker {
  // Who holds each avatar. The local player's entry marks their selection;
  // anyone else's marks the avatar as taken.
  setClaims(
    claims: ReadonlyMap<CharacterId, string>,
    localUsername: string,
  ): void;
  destroy(): void;
}

interface Portrait {
  character: CharacterId;
  button: HTMLButtonElement;
  view: HTMLElement;
  owner: HTMLElement;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  key: THREE.DirectionalLight;
  ambient: THREE.AmbientLight;
  root: THREE.Object3D | null;
  mixer: THREE.AnimationMixer | null;
}

// Six live portraits through one WebGL context: a single canvas lies over the
// grid and each cell is drawn into its own viewport. Six renderers would mean
// six contexts, and browsers cap how many a page may hold.
export function createAvatarPicker(
  root: HTMLElement,
  options: AvatarPickerOptions,
): AvatarPicker {
  root.classList.add("avatar-picker");
  root.innerHTML = `
    <div class="avatar-grid">
      ${CHARACTER_IDS.map(
        (character) => `
          <button type="button" class="avatar-cell" data-avatar="${character}" aria-pressed="false">
            <span class="avatar-view"></span>
            <span class="avatar-name">${CHARACTER_LABELS[character]}</span>
            <span class="avatar-owner"></span>
          </button>
        `,
      ).join("")}
    </div>
    <canvas class="avatar-canvas"></canvas>
  `;

  const canvas = root.querySelector<HTMLCanvasElement>(".avatar-canvas");
  if (!canvas) throw new Error("Avatar picker canvas missing");

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  let disposed = false;

  const portraits: Portrait[] = CHARACTER_IDS.map((character) => {
    const button = root.querySelector<HTMLButtonElement>(
      `[data-avatar="${character}"]`,
    )!;
    const scene = new THREE.Scene();
    const ambient = new THREE.AmbientLight(0xffffff, AVATAR_PICKER.ambientIntensity);
    const key = new THREE.DirectionalLight(0xffffff, AVATAR_PICKER.keyLightIntensity);
    scene.add(ambient, key, key.target);

    const portrait: Portrait = {
      character,
      button,
      view: button.querySelector<HTMLElement>(".avatar-view")!,
      owner: button.querySelector<HTMLElement>(".avatar-owner")!,
      scene,
      camera: new THREE.PerspectiveCamera(AVATAR_PICKER.fov, 1, 0.01, 100),
      key,
      ambient,
      root: null,
      mixer: null,
    };

    button.addEventListener("click", () => {
      if (!button.disabled) options.onSelect(character);
    });

    loadCharacterAsset(character)
      .then((asset) => {
        if (disposed) return;
        const model = cloneSkinned(asset.template);
        scene.add(model);

        const mixer = new THREE.AnimationMixer(model);
        mixer.timeScale = ANIMATION.timeScale;
        const idle = asset.clips.get("idle");
        if (idle) {
          const action = mixer.clipAction(idle);
          action.play();
          // Frame from the clip's first pose so every load frames the same,
          // then start at a random point so the six don't sway in lockstep.
          mixer.update(0);
          frameCharacter(portrait.camera, portrait.key, model, AVATAR_PICKER);
          action.time = Math.random() * idle.duration;
        } else {
          console.warn(`[avatar-picker] ${character} has no "idle" clip`);
          frameCharacter(portrait.camera, portrait.key, model, AVATAR_PICKER);
        }

        portrait.root = model;
        portrait.mixer = mixer;
      })
      .catch((error) => {
        console.warn(`[avatar-picker] could not load ${character}:`, error);
      });

    return portrait;
  });

  const resize = () => {
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, AVATAR_PICKER.maxPixelRatio),
    );
    renderer.setSize(root.clientWidth, root.clientHeight, false);
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(root);
  resize();

  let onScreen = true;
  const visibilityObserver = new IntersectionObserver(([entry]) => {
    onScreen = entry?.isIntersecting ?? true;
  });
  visibilityObserver.observe(root);

  let frame = 0;
  let last = performance.now();
  let pending = 0;
  const tick = () => {
    frame = requestAnimationFrame(tick);
    const now = performance.now();
    // Clamp so a long background pause doesn't fast-forward every idle.
    pending += Math.min((now - last) / 1000, 0.1);
    last = now;
    if (pending < 1 / AVATAR_PICKER.targetFps) return;
    if (document.hidden || !onScreen) return;
    const dt = pending;
    pending = 0;

    const bounds = canvas.getBoundingClientRect();
    renderer.setScissorTest(false);
    renderer.clear();
    renderer.setScissorTest(true);

    for (const portrait of portraits) {
      if (!portrait.root) continue;
      portrait.mixer?.update(dt);

      // Viewports count from the canvas's bottom-left, in CSS pixels.
      const rect = portrait.view.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      if (width <= 0 || height <= 0) continue;
      const left = rect.left - bounds.left;
      const bottom = bounds.bottom - rect.bottom;
      renderer.setViewport(left, bottom, width, height);
      renderer.setScissor(left, bottom, width, height);

      portrait.camera.aspect = width / height;
      portrait.camera.updateProjectionMatrix();
      renderer.render(portrait.scene, portrait.camera);
    }
  };
  tick();

  return {
    setClaims(claims, localUsername) {
      for (const portrait of portraits) {
        const holder = claims.get(portrait.character);
        const mine = holder === localUsername;
        const taken = holder !== undefined && !mine;

        portrait.button.classList.toggle("is-selected", mine);
        portrait.button.classList.toggle("is-taken", taken);
        portrait.button.disabled = taken;
        portrait.button.setAttribute("aria-pressed", String(mine));
        portrait.owner.textContent = mine ? "You" : taken ? holder : "";

        const brightness = taken ? AVATAR_PICKER.takenBrightness : 1;
        portrait.key.intensity = AVATAR_PICKER.keyLightIntensity * brightness;
        portrait.ambient.intensity = AVATAR_PICKER.ambientIntensity * brightness;
      }
    },

    destroy() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      for (const portrait of portraits) {
        if (!portrait.root) continue;
        portrait.mixer?.stopAllAction();
        portrait.mixer?.uncacheRoot(portrait.root);
        // Skeletons are per clone; geometry and textures belong to the cache.
        portrait.root.traverse((child) => {
          const mesh = child as THREE.SkinnedMesh;
          if (mesh.isSkinnedMesh) mesh.skeleton.dispose();
        });
      }
      renderer.dispose();
      renderer.forceContextLoss();
      root.innerHTML = "";
      root.classList.remove("avatar-picker");
    },
  };
}
