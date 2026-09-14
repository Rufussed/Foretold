import * as THREE from "three";
import { CAMERA_FOLLOW } from "./config";

export interface CameraFollow {
  // Takes the camera's current place and orientation as its normal view.
  captureRest(): void;
  // Turn toward a point in the world, or back to the normal view with null.
  // The turn starts after CAMERA_FOLLOW.delaySeconds.
  setTarget(point: THREE.Vector3 | null): void;
  // Moves the camera along its current turn. If something else moved it, such
  // as orbiting, it turns back from wherever it is.
  update(deltaSeconds: number): void;
}

interface Turn {
  fromQuaternion: THREE.Quaternion;
  fromPosition: THREE.Vector3;
  toQuaternion: THREE.Quaternion;
  toPosition: THREE.Vector3;
  elapsed: number;
}

// Slow to start, fastest halfway, slow to stop.
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export function createCameraFollow(camera: THREE.Camera): CameraFollow {
  const restQuaternion = camera.quaternion.clone();
  const restPosition = camera.position.clone();
  let target: THREE.Vector3 | null = null;
  // A new target waiting out the delay before the camera moves.
  let upcoming: { point: THREE.Vector3 | null; wait: number } | null = null;
  let turn: Turn | null = null;
  // Where this last put the camera, to notice anything else moving it.
  const lastQuaternion = camera.quaternion.clone();
  const lastPosition = camera.position.clone();

  const samePoint = (a: THREE.Vector3 | null, b: THREE.Vector3 | null) =>
    a === null ? b === null : b !== null && a.equals(b);

  // The normal place, looking CAMERA_FOLLOW.amount of the way from the normal
  // view toward the target.
  const destination = () => {
    const quaternion = restQuaternion.clone();
    if (target) {
      const eye = camera.parent ? camera.parent.localToWorld(restPosition.clone()) : restPosition.clone();
      // Cameras look down their -Z axis, which is what lookAt(eye, target)
      // builds; then express it relative to any parent the camera has.
      const lookTurn = new THREE.Quaternion().setFromRotationMatrix(
        new THREE.Matrix4().lookAt(eye, target, camera.up),
      );
      if (camera.parent) lookTurn.premultiply(camera.parent.getWorldQuaternion(new THREE.Quaternion()).invert());
      quaternion.slerp(lookTurn, CAMERA_FOLLOW.amount);
    }
    return { quaternion, position: restPosition.clone() };
  };

  const startTurn = (): Turn => {
    const to = destination();
    return {
      fromQuaternion: camera.quaternion.clone(),
      fromPosition: camera.position.clone(),
      toQuaternion: to.quaternion,
      toPosition: to.position,
      elapsed: 0,
    };
  };

  return {
    captureRest() {
      restQuaternion.copy(camera.quaternion);
      restPosition.copy(camera.position);
      lastQuaternion.copy(camera.quaternion);
      lastPosition.copy(camera.position);
      turn = null;
    },

    setTarget(point) {
      if (samePoint(upcoming ? upcoming.point : target, point)) return;
      // A further change during the pause restarts it, so only the latest
      // target is turned to.
      upcoming = { point: point ? point.clone() : null, wait: CAMERA_FOLLOW.delaySeconds };
    },

    update(deltaSeconds) {
      const movedElsewhere =
        camera.quaternion.angleTo(lastQuaternion) > 1e-5 || camera.position.distanceTo(lastPosition) > 1e-5;
      if (turn && movedElsewhere) turn = startTurn();

      if (upcoming) {
        upcoming.wait -= deltaSeconds;
        if (upcoming.wait <= 0) {
          target = upcoming.point;
          upcoming = null;
          turn = startTurn();
        }
      }

      if (!turn) {
        const to = destination();
        const settled =
          camera.quaternion.angleTo(to.quaternion) < 1e-4 && camera.position.distanceTo(to.position) < 1e-4;
        if (settled) return;
        turn = startTurn();
      }

      turn.elapsed += deltaSeconds;
      const progress = Math.min(1, turn.elapsed / Math.max(CAMERA_FOLLOW.turnSeconds, 1e-6));
      const eased = easeInOut(progress);
      camera.position.lerpVectors(turn.fromPosition, turn.toPosition, eased);
      camera.quaternion.slerpQuaternions(turn.fromQuaternion, turn.toQuaternion, eased);
      lastQuaternion.copy(camera.quaternion);
      lastPosition.copy(camera.position);
      if (progress >= 1) turn = null;
    },
  };
}
