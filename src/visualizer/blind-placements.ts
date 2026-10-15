import * as THREE from "three";
import { BLIND_CARDS } from "./config";
import type { Placement } from "./placement";
import type { SeatId } from "./player-characters";
import { centredSlots, type TableLayout } from "./table-layout";

// Who holds a blind card: you, or the player in a seat.
export type BlindHolder = "local" | SeatId;

export interface BlindPlacements {
  // Where a holder's card is held right now, relative to the environment.
  // Heads and the camera move, so ask again each frame.
  slotFor(holder: BlindHolder): Placement;
}

export interface BlindPlacementsOptions {
  environment: THREE.Object3D;
  layout: TableLayout;
  camera(): THREE.Camera;
  // Where a seat's character has their head, and how it is turned, in world
  // space.
  headOf(seat: SeatId): THREE.Vector3 | null;
  headTurnOf(seat: SeatId): THREE.Quaternion | null;
  // How far a seat's head surface is from headOf, so the card clears the face.
  headRadiusOf(seat: SeatId): number | null;
}

const WORLD_UP = new THREE.Vector3(0, 1, 0);

// A blind round's cards are held up facing away from their holders, as players
// hold them to their foreheads: each other player's just in front of their
// forehead (BLIND_CARDS.headForwardMetres and headUpMetres), turning with it
// as if parented to it, and yours in front of the camera
// (BLIND_CARDS.cameraForwardMetres and cameraUpMetres), so you see its back.
//
// The card mesh's face is its +Y side, and the top of its art lies along ±Z:
// whichever way your hand slots point it away from you, since a hand is read
// with its tops furthest off. A held card stands with that axis up.
export function createBlindPlacements({
  environment,
  layout,
  camera,
  headOf,
  headTurnOf,
  headRadiusOf,
}: BlindPlacementsOptions): BlindPlacements {
  const middle = centredSlots(layout.localHand, 1)[0];
  const scale = middle?.scale.clone() ?? new THREE.Vector3(1, 1, 1);

  // The table's middle is the environment's origin.
  const handCentre = layout.localHand
    .reduce((sum, slot) => sum.add(slot.position), new THREE.Vector3())
    .divideScalar(Math.max(layout.localHand.length, 1));
  const away = handCentre.clone().negate().setY(0);
  const artTop = new THREE.Vector3(0, 0, 1).applyQuaternion(middle?.quaternion ?? new THREE.Quaternion());
  const artUpSign = artTop.dot(away) >= 0 ? 1 : -1;

  const toLocalDirection = (world: THREE.Vector3) => {
    environment.updateMatrixWorld();
    return world.clone().transformDirection(environment.matrixWorld.clone().invert());
  };

  // A card at a world position, its face towards `facing`, standing up along
  // `up` (both world directions), as an environment placement.
  const held = (position: THREE.Vector3, facing: THREE.Vector3, up: THREE.Vector3): Placement => {
    const y = toLocalDirection(facing).normalize();
    const z = toLocalDirection(up).projectOnPlane(y).normalize().multiplyScalar(artUpSign);
    const x = new THREE.Vector3().crossVectors(y, z);
    return {
      position: environment.worldToLocal(position.clone()),
      quaternion: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)),
      scale: scale.clone(),
    };
  };

  const localSlot = (): Placement => {
    const view = camera();
    const eye = view.getWorldPosition(new THREE.Vector3());
    const forward = view.getWorldDirection(new THREE.Vector3());
    const up = WORLD_UP.clone().applyQuaternion(view.getWorldQuaternion(new THREE.Quaternion()));
    const position = eye
      .addScaledVector(forward, BLIND_CARDS.cameraForwardMetres)
      .addScaledVector(up, BLIND_CARDS.cameraUpMetres);
    return held(position, forward, up);
  };

  // Square in front of the face, turning with the head as if parented to it.
  // A Mixamo head bone looks along its +Z with +Y up. Without a head bone the
  // card faces the table's middle.
  const seatSlot = (seat: SeatId): Placement => {
    const head = headOf(seat);
    // No character seated there: their hand's middle slot will do.
    if (!head) return centredSlots(layout.handFor(seat), 1)[0] ?? localSlot();
    const turn = headTurnOf(seat);
    const forward = turn
      ? new THREE.Vector3(0, 0, 1).applyQuaternion(turn)
      : environment.localToWorld(new THREE.Vector3()).sub(head).setY(0).normalize();
    const up = turn ? new THREE.Vector3(0, 1, 0).applyQuaternion(turn) : WORLD_UP.clone();
    const distance = (headRadiusOf(seat) ?? 0) + BLIND_CARDS.headForwardMetres;
    const position = head
      .clone()
      .addScaledVector(forward, distance)
      .addScaledVector(up, BLIND_CARDS.headUpMetres);
    return held(position, forward, up);
  };

  return {
    slotFor: (holder) => (holder === "local" ? localSlot() : seatSlot(holder)),
  };
}
