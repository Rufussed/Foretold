import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { ANIMATION, CHARACTER_SEATING, DEFAULT_SEATING } from "./config";

// Visual seat numbers, matching the seat2..seat6 nodes in Wizard.glb. These
// are deliberately not backend player ids; mapping game state onto seats is a
// separate concern.
export type SeatId = 2 | 3 | 4 | 5 | 6;
export const SEAT_IDS: readonly SeatId[] = [2, 3, 4, 5, 6];

export type CharacterId =
  | "forest-elf"
  | "blind-wizard"
  | "black-witch"
  | "kungfu-girl"
  | "goatman"
  | "demon";

export type Emote = "laugh" | "disbelief" | "disapproval" | "thumbsUp";
export type IdleVariant = "idle" | "idleTwitchy";
export type ClipName = IdleVariant | Emote;

export interface PlayerCharacters {
  setCharacter(seat: SeatId, character: CharacterId): Promise<void>;
  setIdle(seat: SeatId, variant: IdleVariant): void;
  // Loops any clip as the seat's base animation, emotes included; emotes
  // still crossfade back to it. Mainly for previewing animations.
  loopClip(seat: SeatId, clip: ClipName): void;
  emote(seat: SeatId, emote: Emote): void;
  clearPlayer(seat: SeatId): void;
  update(deltaSeconds: number): void;
  dispose(): void;
  // Development aid: live animation state for a seat, or null if empty.
  debug(seat: SeatId): CharacterDebugState | null;
}

export interface CharacterDebugState {
  character: CharacterId;
  idleVariant: ClipName; // the looping base clip
  emote: string | null;
  mixer: THREE.AnimationMixer;
  actions: Record<string, THREE.AnimationAction>;
}

const CHARACTER_URLS: Record<CharacterId, string> = {
  "forest-elf": "/models/wizard/char-forest-elf.glb",
  "blind-wizard": "/models/wizard/char-blind-wizard.glb",
  "black-witch": "/models/wizard/char-black-witch.glb",
  "kungfu-girl": "/models/wizard/char-kungfu-girl.glb",
  goatman: "/models/wizard/char-goatman.glb",
  demon: "/models/wizard/char-demon.glb",
};

export const CHARACTER_IDS = Object.keys(CHARACTER_URLS) as readonly CharacterId[];

const IDLE_VARIANTS: readonly IdleVariant[] = ["idle", "idleTwitchy"];
const EMOTES: readonly Emote[] = ["laugh", "disbelief", "disapproval", "thumbsUp"];
export const CLIP_NAMES: readonly ClipName[] = [...IDLE_VARIANTS, ...EMOTES];
const CROSSFADE_SECONDS = 0.2;

interface CharacterAsset {
  template: THREE.Object3D;
  clips: Map<string, THREE.AnimationClip>;
}

interface SeatedCharacter {
  character: CharacterId;
  root: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  clips: Map<string, THREE.AnimationClip>;
  idleVariant: ClipName;
  idleAction: THREE.AnimationAction | null;
  emoteAction: THREE.AnimationAction | null;
  onFinished: (event: { action: THREE.AnimationAction }) => void;
}

// Blender's NLA Tracks export keeps every strip at its absolute position on
// the timeline, so "thumbsUp" arrives as keys from ~30s to ~34s. three sizes
// a clip by its last key, which would play 30s of held pose before any motion.
// All tracks in a clip share the strip's start, so shifting them together
// makes each clip begin at its own first frame.
function startAtZero(clip: THREE.AnimationClip): THREE.AnimationClip {
  let start = Infinity;
  for (const track of clip.tracks) {
    if (track.times.length) start = Math.min(start, track.times[0]);
  }
  if (!Number.isFinite(start) || start === 0) return clip;

  // GLTFLoader gives every track that shares a sampler input the *same* times
  // array, so shifting track by track moves those keys once per track and
  // collapses later clips to zero length. Shift each array once, into a copy,
  // so tracks keep sharing and nothing outside this clip is mutated.
  const shifted = new Map<Float32Array, Float32Array>();
  for (const track of clip.tracks) {
    let times = shifted.get(track.times);
    if (!times) {
      times = Float32Array.from(track.times, (t) => t - start);
      shifted.set(track.times, times);
    }
    track.times = times;
  }
  clip.resetDuration();
  return clip;
}

// Seating offsets are written in Blender axes (Z up) so they match what an
// object parented to a seat empty shows in Blender. glTF turns Z-up into Y-up
// with a -90° rotation about X, so apply the same change of basis here.
const BLENDER_TO_THREE = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
const THREE_TO_BLENDER = new THREE.Matrix4().makeRotationX(Math.PI / 2);

function applySeating(root: THREE.Object3D, character: CharacterId): void {
  const extra = CHARACTER_SEATING[character] ?? {};
  const position = new THREE.Vector3(...(DEFAULT_SEATING.position ?? [0, 0, 0])).add(
    new THREE.Vector3(...(extra.position ?? [0, 0, 0])),
  );
  const [rx, ry, rz] = [0, 1, 2].map((i) =>
    THREE.MathUtils.degToRad(
      (DEFAULT_SEATING.rotation?.[i] ?? 0) + (extra.rotation?.[i] ?? 0),
    ),
  );
  const scale = (DEFAULT_SEATING.scale ?? 1) * (extra.scale ?? 1);

  const inBlender = new THREE.Matrix4().compose(
    position,
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, "XYZ")),
    new THREE.Vector3(scale, scale, scale),
  );
  BLENDER_TO_THREE.clone()
    .multiply(inBlender)
    .multiply(THREE_TO_BLENDER)
    .decompose(root.position, root.quaternion, root.scale);
}

// Geometry, materials and textures are shared between every clone of an
// asset, so they are released only when the whole cache goes.
function disposeSharedResources(object: THREE.Object3D): void {
  const materials = new Set<THREE.Material>();
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    list.forEach((m) => materials.add(m));
  });
  for (const material of materials) {
    for (const value of Object.values(material)) {
      if ((value as THREE.Texture | null)?.isTexture) (value as THREE.Texture).dispose();
    }
    material.dispose();
  }
}

export function createPlayerCharacters(
  seats: ReadonlyMap<SeatId, THREE.Object3D>,
): PlayerCharacters {
  const loader = new GLTFLoader();
  const assets = new Map<CharacterId, Promise<CharacterAsset>>();
  const seated = new Map<SeatId, SeatedCharacter>();
  const idlePreference = new Map<SeatId, ClipName>();
  // Only the most recent setCharacter/clearPlayer per seat may take effect, so
  // a slow load can't overwrite a newer choice when it finally resolves.
  const latestRequest = new Map<SeatId, number>();
  let requestCounter = 0;
  let disposed = false;

  const loadAsset = (character: CharacterId): Promise<CharacterAsset> => {
    const cached = assets.get(character);
    if (cached) return cached;

    const url = CHARACTER_URLS[character];
    const pending = url
      ? loader.loadAsync(url).then((gltf) => {
          gltf.scene.traverse((child) => {
            const mesh = child as THREE.SkinnedMesh;
            if (!mesh.isMesh) return;
            // Characters receive shadows but don't cast them: with several
            // skinned meshes in view, casting costs a lot for little gain.
            mesh.castShadow = false;
            mesh.receiveShadow = true;
            // Skinned bounds are computed from the bind pose, so animated
            // limbs can be culled while still on screen.
            if (mesh.isSkinnedMesh) mesh.frustumCulled = false;
          });
          return {
            template: gltf.scene,
            clips: new Map(gltf.animations.map((clip) => [clip.name, startAtZero(clip)])),
          };
        })
      : Promise.reject(new Error(`Unknown character "${character}"`));

    assets.set(character, pending);
    // Forget failures so a later attempt can retry rather than fail forever.
    pending.catch(() => {
      if (assets.get(character) === pending) assets.delete(character);
    });
    return pending;
  };

  const actionFor = (instance: SeatedCharacter, name: string) => {
    const clip = instance.clips.get(name);
    if (!clip) {
      console.warn(`[players] ${instance.character} has no "${name}" clip`);
      return null;
    }
    return instance.mixer.clipAction(clip);
  };

  const playIdle = (instance: SeatedCharacter, variant: ClipName): void => {
    instance.idleVariant = variant;
    const next = actionFor(instance, variant);
    const previous = instance.idleAction;
    if (!next || next === previous) return;

    if (next === instance.emoteAction) {
      // The clip is already on screen as an emote: keep it playing and let it
      // carry on as the loop, rather than restarting it.
      instance.emoteAction = null;
      next.setLoop(THREE.LoopRepeat, Infinity);
      next.clampWhenFinished = false;
      next.paused = false;
      previous?.stop();
      instance.idleAction = next;
      return;
    }

    next.reset();
    next.setLoop(THREE.LoopRepeat, Infinity);
    // Random phase stops several players swaying in lockstep.
    next.time = Math.random() * next.getClip().duration;
    instance.idleAction = next;

    if (instance.emoteAction) {
      // An emote owns the pose; the new idle is faded in when it finishes.
      previous?.stop();
      return;
    }
    next.play();
    if (previous) previous.crossFadeTo(next, CROSSFADE_SECONDS, false);
  };

  const removeSeated = (seat: SeatId): void => {
    const instance = seated.get(seat);
    if (!instance) return;
    seated.delete(seat);
    instance.mixer.removeEventListener("finished", instance.onFinished);
    instance.mixer.stopAllAction();
    instance.mixer.uncacheRoot(instance.root);
    instance.root.removeFromParent();
    // Skeletons are per-clone (unlike geometry and materials).
    instance.root.traverse((child) => {
      const mesh = child as THREE.SkinnedMesh;
      if (mesh.isSkinnedMesh) mesh.skeleton.dispose();
    });
  };

  return {
    async setCharacter(seat, character) {
      if (disposed) return;
      const seatNode = seats.get(seat);
      if (!seatNode) throw new Error(`No seat${seat} node in the scene`);

      const request = ++requestCounter;
      latestRequest.set(seat, request);
      if (seated.get(seat)?.character === character) return;

      const asset = await loadAsset(character);
      if (disposed || latestRequest.get(seat) !== request) return;

      removeSeated(seat);

      const root = cloneSkinned(asset.template);
      root.name = `player-seat${seat}-${character}`;
      applySeating(root, character);
      seatNode.add(root);

      const mixer = new THREE.AnimationMixer(root);
      mixer.timeScale = ANIMATION.timeScale;

      const instance: SeatedCharacter = {
        character,
        root,
        mixer,
        clips: asset.clips,
        idleVariant: "idle",
        idleAction: null,
        emoteAction: null,
        onFinished: ({ action }) => {
          // A superseded emote can still reach its end while fading out; only
          // the emote currently in charge may hand back to idle.
          if (action !== instance.emoteAction) return;
          instance.emoteAction = null;
          const idle = instance.idleAction;
          if (!idle) return;
          idle.enabled = true;
          idle.play();
          action.crossFadeTo(idle, CROSSFADE_SECONDS, false);
        },
      };
      mixer.addEventListener("finished", instance.onFinished);
      seated.set(seat, instance);

      const variant =
        idlePreference.get(seat) ??
        IDLE_VARIANTS[Math.floor(Math.random() * IDLE_VARIANTS.length)];
      playIdle(instance, variant);
    },

    setIdle(seat, variant) {
      if (!IDLE_VARIANTS.includes(variant)) {
        console.warn(`[players] unknown idle variant "${variant}"`);
        return;
      }
      idlePreference.set(seat, variant);
      const instance = seated.get(seat);
      if (instance) playIdle(instance, variant);
    },

    loopClip(seat, clip) {
      if (!CLIP_NAMES.includes(clip)) {
        console.warn(`[players] unknown clip "${clip}"`);
        return;
      }
      idlePreference.set(seat, clip);
      const instance = seated.get(seat);
      if (instance) playIdle(instance, clip);
    },

    emote(seat, emote) {
      const instance = seated.get(seat);
      if (!instance) {
        console.warn(`[players] seat ${seat} has no character`);
        return;
      }
      if (!EMOTES.includes(emote)) {
        console.warn(`[players] unknown emote "${emote}"`);
        return;
      }
      const next = actionFor(instance, emote);
      if (!next) return;

      if (next === instance.idleAction) {
        // This emote is the seat's looping clip: restart the loop instead of
        // turning it into a one-shot, which would stop it ever looping again.
        const playing = instance.emoteAction;
        instance.emoteAction = null;
        next.reset();
        next.setLoop(THREE.LoopRepeat, Infinity);
        next.play();
        if (playing) playing.crossFadeTo(next, CROSSFADE_SECONDS, false);
        return;
      }

      const from = instance.emoteAction ?? instance.idleAction;
      next.reset();
      next.setLoop(THREE.LoopOnce, 1);
      next.clampWhenFinished = true;
      next.play();
      if (from && from !== next) from.crossFadeTo(next, CROSSFADE_SECONDS, false);
      instance.emoteAction = next;
    },

    clearPlayer(seat) {
      latestRequest.set(seat, ++requestCounter);
      idlePreference.delete(seat);
      removeSeated(seat);
    },

    update(deltaSeconds) {
      for (const instance of seated.values()) instance.mixer.update(deltaSeconds);
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      for (const seat of [...seated.keys()]) removeSeated(seat);
      for (const pending of assets.values()) {
        pending.then((asset) => disposeSharedResources(asset.template)).catch(() => {});
      }
      assets.clear();
    },

    debug(seat) {
      const instance = seated.get(seat);
      if (!instance) return null;
      const actions: Record<string, THREE.AnimationAction> = {};
      for (const [name, clip] of instance.clips) {
        const action = instance.mixer.existingAction(clip);
        if (action) actions[name] = action;
      }
      return {
        character: instance.character,
        idleVariant: instance.idleVariant,
        emote: instance.emoteAction?.getClip().name ?? null,
        mixer: instance.mixer,
        actions,
      };
    },
  };
}
