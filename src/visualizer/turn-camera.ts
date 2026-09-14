import * as THREE from "three";
import { CAMERA_FOLLOW } from "./config";
import { isLocalTurn, type GameConnection } from "./game-connection";
import type { SeatId } from "./player-characters";
import type { TableLayout } from "./table-layout";
import type { SceneView } from "./three-scene";

export interface TurnCameraOptions {
  view: SceneView;
  environment: THREE.Object3D;
  layout: TableLayout;
  game: GameConnection;
  seatOf(username: string): SeatId | null;
}

// Turns the camera toward whoever's turn it is, whether they're bidding,
// choosing trump or playing. On your own turn, and once the game is over, it
// eases back to the normal view.
export function createTurnCamera({
  view,
  environment,
  layout,
  game,
  seatOf,
}: TurnCameraOptions): { applyState(): void } {
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
    applyState() {
      const state = game.state();
      const current = state?.players[state.currentPlayerIndex];
      const seat =
        CAMERA_FOLLOW.enabled && state && state.phase !== "finished" && current && !isLocalTurn(game)
          ? seatOf(current.username)
          : null;
      view.lookToward(seat === null ? null : aimAt(seat));
    },
  };
}
