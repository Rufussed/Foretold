import * as THREE from "three";
import { findBone } from "./character-assets";

export interface PortraitFraming {
  fov: number; // vertical, degrees
  span: number; // how much fits vertically, in hip-to-face heights
  lookOffset: number; // aim point relative to the face, in hip-to-face heights
  azimuthDegrees: number; // turn around the character; 0 is straight on
}

const WORLD_UP = new THREE.Vector3(0, 1, 0);

// Frames a character front-on with the camera at face height, and puts the key
// light at the camera. Facing comes from the rig: with Y up, (left hip - right
// hip) x up points the way the character faces, so no per-model rotation needs
// configuring. Sizes are relative to each character's own hip-to-face height.
export function frameCharacter(
  camera: THREE.PerspectiveCamera,
  key: THREE.DirectionalLight,
  root: THREE.Object3D,
  framing: PortraitFraming,
): void {
  root.updateMatrixWorld(true);
  const bone = (name: string) =>
    findBone(root, name)?.getWorldPosition(new THREE.Vector3());
  const head = bone("mixamorig:Head");
  const headTop = bone("mixamorig:HeadTop_End");
  const hips = bone("mixamorig:Hips");
  const leftHip = bone("mixamorig:LeftUpLeg");
  const rightHip = bone("mixamorig:RightUpLeg");

  let face = head && headTop ? head.clone().lerp(headTop, 0.5) : head;
  let base = hips;
  if (!face || !base) {
    const box = new THREE.Box3().setFromObject(root);
    face ??= new THREE.Vector3(0, box.min.y + (box.max.y - box.min.y) * 0.9, 0);
    base ??= box.getCenter(new THREE.Vector3());
  }
  const height = Math.max(face.y - base.y, 0.01);

  const forward =
    leftHip && rightHip
      ? leftHip.clone().sub(rightHip).cross(WORLD_UP)
      : new THREE.Vector3(0, 0, 1);
  forward.y = 0;
  if (forward.lengthSq() < 1e-8) forward.set(0, 0, 1);
  forward
    .normalize()
    .applyAxisAngle(WORLD_UP, THREE.MathUtils.degToRad(framing.azimuthDegrees));

  camera.fov = framing.fov;
  const distance =
    (framing.span * height) / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  camera.near = distance / 100;
  camera.far = distance * 10;
  camera.position.copy(face).addScaledVector(forward, distance);
  camera.lookAt(face.clone().addScaledVector(WORLD_UP, framing.lookOffset * height));
  camera.updateProjectionMatrix();

  key.position.copy(camera.position);
  key.target.position.copy(face);
}
