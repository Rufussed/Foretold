import * as THREE from "three";
import { TRUMP_CROWN } from "./config";

export interface TrumpCrown {
  update(deltaSeconds: number): void;
  dispose(): void;
}

// A little crown emoji hovering over the middle of the trump card, just in
// front of it as the camera sees it, bobbing gently. A sprite, so it always
// faces the camera. Sized from the card itself, so it suits the table's scale
// whatever the card targets are.
export function createTrumpCrown(
  environment: THREE.Object3D,
  camera: THREE.Camera,
  trumpCard: () => THREE.Object3D | null,
): TrumpCrown {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d")!;
  context.font = "96px 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("👑", 64, 70);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, toneMapped: false, depthWrite: false });
  const crown = new THREE.Sprite(material);
  crown.name = "trump-crown";
  crown.visible = false;
  crown.renderOrder = 10;
  environment.add(crown);

  const bounds = new THREE.Box3();
  const size = new THREE.Vector3();
  const spot = new THREE.Vector3();
  const towardCamera = new THREE.Vector3();
  let clock = 0;

  return {
    update(deltaSeconds) {
      clock += deltaSeconds;
      const card = trumpCard();
      crown.visible = !!card;
      if (!card) return;

      bounds.setFromObject(card);
      bounds.getSize(size);
      const cardLength = Math.max(size.x, size.z);
      const bob = Math.sin((clock / TRUMP_CROWN.bobSeconds) * Math.PI * 2) * TRUMP_CROWN.bobLengths * cardLength;
      // The card's middle, raised or lowered by verticalOffset, then nudged
      // level toward the camera so it sits just in front without rising.
      bounds.getCenter(spot);
      spot.y += TRUMP_CROWN.verticalOffset + bob;
      camera.getWorldPosition(towardCamera).sub(spot);
      towardCamera.y = 0;
      if (towardCamera.lengthSq() > 1e-8) spot.addScaledVector(towardCamera.normalize(), TRUMP_CROWN.frontLengths * cardLength);
      crown.position.copy(environment.worldToLocal(spot));
      crown.scale.setScalar(TRUMP_CROWN.sizeLengths * cardLength);
    },

    dispose() {
      crown.removeFromParent();
      material.dispose();
      texture.dispose();
    },
  };
}
