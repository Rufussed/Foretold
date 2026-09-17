import * as THREE from "three";
import { CAMERA_FOLLOW } from "./config";
import type { SeatId } from "./player-characters";
import type { TableLayout } from "./table-layout";
import type { SceneView } from "./three-scene";

export interface TurnCamera {
  // Turns toward a player, or back to the normal view for null (also used for
  // you); done once the camera is there.
  lookAt(username: string | null, done: () => void): void;
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

  // Just above the middle of that player's card set, which faces them.
  const aimAt = (seat: SeatId) => {
    let point = aims.get(seat);
    if (!point) {
      const hand = layout.handFor(seat);
      const centre = hand
        .reduce((sum, slot) => sum.add(slot.position), new THREE.Vector3())
        .divideScalar(Math.max(hand.length, 1));
      point = environment.localToWorld(centre).add(new THREE.Vector3(0, CAMERA_FOLLOW.lookHeight, 0));
      aims.set(seat, point);
    }
    return point;
  };

  return {
    lookAt(username, done) {
      const seat =
        CAMERA_FOLLOW.enabled && username !== null && username !== localUsername ? seatOf(username) : null;
      view.lookToward(seat === null ? null : aimAt(seat), done);
    },
  };
}
