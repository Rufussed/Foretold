import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import blackWitchModel from "../assets/models/wizard/char-black-witch.glb?url";
import blindWizardModel from "../assets/models/wizard/char-blind-wizard.glb?url";
import demonModel from "../assets/models/wizard/char-demon.glb?url";
import forestElfModel from "../assets/models/wizard/char-forest-elf.glb?url";
import goatmanModel from "../assets/models/wizard/char-goatman.glb?url";
import kungfuGirlModel from "../assets/models/wizard/char-kungfu-girl.glb?url";
import { characterTextureLimit, limitTextureSizes } from "./texture-limit";
import {
  AVATAR_IDS,
  type AvatarId,
} from "../../backend/src/game/wizard/models/avatar";

// Character ids are the backend's avatar ids, so a claimed avatar names its
// model directly.
export type CharacterId = AvatarId;
export const CHARACTER_IDS: readonly CharacterId[] = AVATAR_IDS;

export interface CharacterAsset {
  template: THREE.Object3D;
  clips: Map<string, THREE.AnimationClip>;
}

// Each model is imported rather than named by path, so Vite copies it into the
// build with a hash of its contents in the filename: a re-exported character
// arrives as a new URL, which a player's cache cannot serve the old bytes for.
// Written out one by one rather than globbed because the Record's key type then
// makes a new avatar id a build error here until its model is imported, rather
// than an undefined URL at runtime.
const CHARACTER_URLS: Record<CharacterId, string> = {
  "forest-elf": forestElfModel,
  "blind-wizard": blindWizardModel,
  "black-witch": blackWitchModel,
  "kungfu-girl": kungfuGirlModel,
  goatman: goatmanModel,
  demon: demonModel,
};

const characterUrl = (character: CharacterId): string => CHARACTER_URLS[character];

// For the prefetch queue, which on a small device warms the browser cache with
// the file rather than parsing it into a model.
export const characterModelUrl = characterUrl;

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

// One cache for the whole page session, shared by the avatar picker and the
// table, so characters loaded in the waiting room are already parsed when the
// game starts. Every consumer clones the templates rather than mutating them,
// and each renderer's forceContextLoss releases its GPU copies, so entries are
// kept when a scene is torn down.
const loader = new GLTFLoader();
const assets = new Map<CharacterId, Promise<CharacterAsset>>();

export function loadCharacterAsset(
  character: CharacterId,
): Promise<CharacterAsset> {
  const cached = assets.get(character);
  if (cached) return cached;

  const pending = CHARACTER_IDS.includes(character)
    ? loader.loadAsync(characterUrl(character)).then(async (gltf) => {
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
        await limitTextureSizes(gltf.scene, characterTextureLimit());
        return {
          template: gltf.scene,
          clips: new Map(
            gltf.animations.map((clip) => [clip.name, startAtZero(clip)]),
          ),
        };
      })
    : Promise.reject(new Error(`Unknown character "${character}"`));

  assets.set(character, pending);
  // Forget failures so a later attempt can retry rather than fail forever.
  pending.catch(() => {
    if (assets.get(character) === pending) assets.delete(character);
  });
  return pending;
}

const canonicalBoneName = (name: string): string =>
  name.replace(/[^a-z0-9]/gi, "").toLowerCase();

// GLTFLoader strips reserved characters from node names, so Mixamo's
// "mixamorig:Head" arrives as "mixamorigHead". Match either spelling.
export function findBone(
  root: THREE.Object3D,
  name: string,
): THREE.Object3D | undefined {
  const wanted = canonicalBoneName(name);
  let found: THREE.Object3D | undefined;
  root.traverse((object) => {
    if (!found && canonicalBoneName(object.name) === wanted) found = object;
  });
  return found;
}
