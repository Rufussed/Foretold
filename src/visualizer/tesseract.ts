import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import tesseractModel from "../assets/models/wizard/tesseract.glb?url";
import { ANIMATION, TESSERACT } from "./config";

const TESSERACT_URL = tesseractModel;

export interface TesseractModel {
  template: THREE.Object3D;
  clips: THREE.AnimationClip[];
  centre: THREE.Vector3; // middle of the model, where it grows from
  size: number; // its largest dimension, in its own units
}

let loading: Promise<TesseractModel> | null = null;

// Loads the tesseract once; later calls share it.
export function loadTesseract(): Promise<TesseractModel> {
  if (!loading) {
    const pending = new GLTFLoader().loadAsync(TESSERACT_URL).then((gltf) => {
      gltf.scene.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(gltf.scene);
      const dimensions = box.getSize(new THREE.Vector3());
      return {
        template: gltf.scene,
        clips: gltf.animations,
        centre: box.getCenter(new THREE.Vector3()),
        size: Math.max(dimensions.x, dimensions.y, dimensions.z, 1e-6),
      };
    });
    // Forget a failure so a later call can retry.
    pending.catch(() => {
      if (loading === pending) loading = null;
    });
    loading = pending;
  }
  return loading;
}

export interface Tesseract {
  // Positioned at the tesseract's centre.
  readonly object: THREE.Object3D;
  // Scale 1 is TESSERACT.size scene units across; 0 hides it.
  setScale(scale: number): void;
  // Tints it: body and glow take the colour, with a gentler glow and a more
  // solid body so the colour dominates. Null restores its own blue.
  setColor(color: string | null): void;
  update(deltaSeconds: number): void;
  dispose(): void;
}

// One spinning tesseract: a copy of the model centred on its own origin, with
// its own materials so it can be tinted alone.
export function createTesseract(model: TesseractModel, parent: THREE.Object3D): Tesseract {
  const object = new THREE.Group();
  object.name = "tesseract";
  const copy = cloneSkinned(model.template);
  copy.position.copy(model.centre).negate();
  object.add(copy);
  object.visible = false;
  parent.add(object);

  const baseScale = TESSERACT.size / model.size;
  const materials: Array<{
    material: THREE.MeshStandardMaterial;
    color: THREE.Color;
    emissive: THREE.Color;
    glow: number;
    opacity: number;
  }> = [];
  copy.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || Array.isArray(mesh.material)) return;
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    const material = (mesh.material as THREE.MeshStandardMaterial).clone();
    mesh.material = material;
    materials.push({
      material,
      color: material.color.clone(),
      emissive: material.emissive.clone(),
      glow: material.emissiveIntensity,
      opacity: material.opacity,
    });
  });

  const mixer = new THREE.AnimationMixer(copy);
  mixer.timeScale = ANIMATION.timeScale;
  for (const clip of model.clips) mixer.clipAction(clip).play();

  return {
    object,

    setScale(scale) {
      const size = Math.max(scale, 0) * baseScale;
      object.visible = size > 1e-6;
      object.scale.setScalar(Math.max(size, 1e-6));
    },

    setColor(color) {
      for (const entry of materials) {
        if (color) {
          entry.material.color.set(color);
          entry.material.emissive.set(color);
          entry.material.emissiveIntensity = TESSERACT.tintGlow;
          entry.material.opacity = TESSERACT.tintOpacity;
        } else {
          entry.material.color.copy(entry.color);
          entry.material.emissive.copy(entry.emissive);
          entry.material.emissiveIntensity = entry.glow;
          entry.material.opacity = entry.opacity;
        }
      }
    },

    update(deltaSeconds) {
      mixer.update(deltaSeconds);
    },

    dispose() {
      mixer.stopAllAction();
      mixer.uncacheRoot(copy);
      object.removeFromParent();
      for (const entry of materials) entry.material.dispose();
      copy.traverse((child) => {
        const mesh = child as THREE.SkinnedMesh;
        if (mesh.isSkinnedMesh) mesh.skeleton.dispose();
      });
    },
  };
}
