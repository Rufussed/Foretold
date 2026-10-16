import * as THREE from "three";
import { CAMERA_FOLLOW } from "./config";
import type { SeatId } from "./player-characters";
import type { TableLayout } from "./table-layout";
import type { SceneView } from "./three-scene";

export interface TurnCamera {
  // Turns toward a player, or back to the normal view for null (also used for
  // you); done once the camera is there.
  lookAt(username: string | null, done: () => void, seconds?: number): void;
}

export interface TurnCameraOptions {
  view: SceneView;
  environment: THREE.Object3D;
  layout: TableLayout;
  localUsername: string;
  seatOf(username: string): SeatId | null;
}

// Turns the camera toward a player at the table: whoever's move it is, or a
// trick's winner. The table director says when.
export function createTurnCamera({
  view,
  environment,
  layout,
  localUsername,
  seatOf,
}: TurnCameraOptions): TurnCamera {
  const aims = new Map<SeatId, THREE.Vector3>();

  // Just in front of the player's root: their seat node, which the character
  // is parented to, moved a little along its local +Z.
  // The camera only turns about the vertical axis toward it, so its height
  // plays no part. Falls back to the middle of their card set.
  const aimAt = (seat: SeatId) => {
    let point = aims.get(seat);
    if (!point) {
      const node = environment.getObjectByName(`seat${seat}`);
      if (node) {
        environment.updateWorldMatrix(true, true);
        point = node.getWorldPosition(new THREE.Vector3());
        // Out in front of them: along the node's local +Z, the way it faces.
        const forward = new THREE.Vector3(0, 0, 1).transformDirection(node.matrixWorld);
        point.addScaledVector(forward, CAMERA_FOLLOW.aimOutLength);
      } else {
        const hand = layout.handFor(seat);
        const centre = hand
          .reduce((sum, slot) => sum.add(slot.position), new THREE.Vector3())
          .divideScalar(Math.max(hand.length, 1));
        point = environment.localToWorld(centre);
      }
      aims.set(seat, point);
    }
    return point;
  };

  return {
    lookAt(username, done, seconds) {
      const seat =
        CAMERA_FOLLOW.enabled && username !== null && username !== localUsername ? seatOf(username) : null;
      view.lookToward(seat === null ? null : aimAt(seat), done, seconds);
    },
  };
}
