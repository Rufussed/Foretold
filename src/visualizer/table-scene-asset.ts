import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { WIZARD_TABLE_MODEL_URL } from "./environment-setup";

// One copy of the table scene as its user needs it: the node tree, its
// cameras (found within that copy) and the clips that animate it.
export interface TableSceneCopy {
  scene: THREE.Group;
  cameras: THREE.Camera[];
  animations: THREE.AnimationClip[];
}

let parsed: Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }> | null = null;

// Wizard.glb is downloaded and parsed once per visit, first by whichever needs
// it (usually the background scene on the home page), so the 3D view opens
// without loading it again. Each call returns a fresh copy of the node tree,
// since users change it (lights, hidden cards, the camera); geometry, materials
// and textures are shared between copies, and clips bind by node name.
export function loadTableScene(): Promise<TableSceneCopy> {
  parsed ??= new GLTFLoader().loadAsync(WIZARD_TABLE_MODEL_URL).then((gltf) => ({
    scene: gltf.scene,
    animations: gltf.animations,
  }));
  // Allow a retry after a failed download.
  parsed.catch(() => {
    parsed = null;
  });

  return parsed.then((template) => {
    const scene = template.scene.clone(true);
    const cameras: THREE.Camera[] = [];
    scene.traverse((object) => {
      if ((object as THREE.Camera).isCamera) cameras.push(object as THREE.Camera);
    });
    return { scene, cameras, animations: template.animations };
  });
}
