import * as THREE from "three";

// Where something sits, relative to the environment root: the space that
// objects added to the environment are positioned in.
export interface Placement {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: THREE.Vector3;
}

// Call environment.updateMatrixWorld(true) first if anything has moved.
export function placementOf(node: THREE.Object3D, environment: THREE.Object3D): Placement {
  const placement: Placement = {
    position: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
    scale: new THREE.Vector3(),
  };
  environment.matrixWorld
    .clone()
    .invert()
    .multiply(node.matrixWorld)
    .decompose(placement.position, placement.quaternion, placement.scale);
  return placement;
}

export function applyPlacement(object: THREE.Object3D, placement: Placement): void {
  object.position.copy(placement.position);
  object.quaternion.copy(placement.quaternion);
  object.scale.copy(placement.scale);
}

// Nodes named by a numbered pattern such as /^card(\d+)$/, in number order.
export function numberedNodes(root: THREE.Object3D, pattern: RegExp): THREE.Object3D[] {
  const found: Array<[number, THREE.Object3D]> = [];
  root.traverse((object) => {
    const match = pattern.exec(object.name);
    if (match) found.push([Number(match[1]), object]);
  });
  return found.sort((a, b) => a[0] - b[0]).map(([, object]) => object);
}
