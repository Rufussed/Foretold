import * as THREE from "three";
import { EMOTE_NAMES, type Emote } from "../../backend/src/game/wizard/models/emote";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { findBone, loadCharacterAsset, type CharacterId } from "./character-assets";
import { createCharacterAnimator, type CharacterAnimator } from "./character-animator";
import { CHARACTER_SEATING, DEFAULT_SEATING } from "./config";

export { CHARACTER_IDS, type CharacterId } from "./character-assets";

// Visual seat numbers, matching the seat2..seat6 nodes in Wizard.glb. These
// are deliberately not backend player ids; mapping game state onto seats is a
// separate concern.
export type SeatId = 2 | 3 | 4 | 5 | 6;
export const SEAT_IDS: readonly SeatId[] = [2, 3, 4, 5, 6];

// The emote list lives with the game models, so the server can validate the
// ones players send each other against exactly what is animated here.
export type { Emote };
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
  // Where a seated character's head is, in world space; null if the seat is empty.
  headPosition(seat: SeatId): THREE.Vector3 | null;
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

const IDLE_VARIANTS: readonly IdleVariant[] = ["idle", "idleTwitchy"];
export { EMOTE_NAMES };
export const CLIP_NAMES: readonly ClipName[] = [...IDLE_VARIANTS, ...EMOTE_NAMES];

interface SeatedCharacter {
  character: CharacterId;
  root: THREE.Object3D;
  animator: CharacterAnimator;
  head: THREE.Object3D | null;
  headTop: THREE.Object3D | null;
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

export function createPlayerCharacters(
  seats: ReadonlyMap<SeatId, THREE.Object3D>,
): PlayerCharacters {
  const seated = new Map<SeatId, SeatedCharacter>();
  const idlePreference = new Map<SeatId, ClipName>();
  // Only the most recent setCharacter/clearPlayer per seat may take effect, so
  // a slow load can't overwrite a newer choice when it finally resolves.
  const latestRequest = new Map<SeatId, number>();
  let requestCounter = 0;
  let disposed = false;

  const removeSeated = (seat: SeatId): void => {
    const instance = seated.get(seat);
    if (!instance) return;
    seated.delete(seat);
    instance.animator.dispose();
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

      const asset = await loadCharacterAsset(character);
      if (disposed || latestRequest.get(seat) !== request) return;

      removeSeated(seat);

      const root = cloneSkinned(asset.template);
      root.name = `player-seat${seat}-${character}`;
      applySeating(root, character);
      seatNode.add(root);

      const animator = createCharacterAnimator(root, asset.clips, character);
      seated.set(seat, {
        character,
        root,
        animator,
        head: findBone(root, "mixamorig:Head") ?? null,
        headTop: findBone(root, "mixamorig:HeadTop_End") ?? null,
      });

      // Plain idle unless a variant was chosen for this seat.
      animator.playLoop(idlePreference.get(seat) ?? "idle");
    },

    setIdle(seat, variant) {
      if (!IDLE_VARIANTS.includes(variant)) {
        console.warn(`[players] unknown idle variant "${variant}"`);
        return;
      }
      idlePreference.set(seat, variant);
      seated.get(seat)?.animator.playLoop(variant);
    },

    loopClip(seat, clip) {
      if (!CLIP_NAMES.includes(clip)) {
        console.warn(`[players] unknown clip "${clip}"`);
        return;
      }
      idlePreference.set(seat, clip);
      seated.get(seat)?.animator.playLoop(clip);
    },

    emote(seat, emote) {
      const instance = seated.get(seat);
      if (!instance) {
        console.warn(`[players] seat ${seat} has no character`);
        return;
      }
      if (!EMOTE_NAMES.includes(emote)) {
        console.warn(`[players] unknown emote "${emote}"`);
        return;
      }
      instance.animator.playOnce(emote);
    },

    clearPlayer(seat) {
      latestRequest.set(seat, ++requestCounter);
      idlePreference.delete(seat);
      removeSeated(seat);
    },

    update(deltaSeconds) {
      for (const instance of seated.values()) instance.animator.update(deltaSeconds);
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      for (const seat of [...seated.keys()]) removeSeated(seat);
      // Cached assets are shared with other screens and outlive this scene;
      // the renderer's forceContextLoss releases their GPU copies.
    },

    headPosition(seat) {
      const instance = seated.get(seat);
      if (!instance) return null;
      // Midway between the base of the skull and the top of the head.
      const base = (instance.head ?? instance.root).getWorldPosition(new THREE.Vector3());
      return instance.headTop ? base.lerp(instance.headTop.getWorldPosition(new THREE.Vector3()), 0.5) : base;
    },

    debug(seat) {
      const instance = seated.get(seat);
      if (!instance) return null;
      return {
        character: instance.character,
        idleVariant: instance.animator.loop as ClipName,
        emote: instance.animator.emote,
        mixer: instance.animator.mixer,
        actions: instance.animator.actions(),
      };
    },
  };
}
