import * as THREE from "three";
import { CAMERA_FOLLOW } from "./config";
import { paced } from "./pace";

export interface CameraFollow {
  // Takes the camera's current place and orientation as its normal view.
  captureRest(): void;
  // Turn toward a point in the world, or back to the normal view with null.
  // The turn starts after CAMERA_FOLLOW.delaySeconds; onArrive is called once
  // the camera is there (or if a newer target replaces this one).
  // seconds overrides CAMERA_FOLLOW.turnSeconds for this turn alone.
  setTarget(point: THREE.Vector3 | null, onArrive?: () => void, seconds?: number): void;
  // Moves the camera along its current turn. If something else moved it, such
  // as orbiting, it turns back from wherever it is.
  update(deltaSeconds: number): void;
  // How far the camera has turned about the vertical axis from its normal
  // view, in radians, positive counter-clockwise seen from above.
  yaw(): number;
}

interface Turn {
  fromQuaternion: THREE.Quaternion;
  fromPosition: THREE.Vector3;
  toQuaternion: THREE.Quaternion;
  toPosition: THREE.Vector3;
  elapsed: number;
  seconds: number | undefined;
}

// Slow to start, fastest halfway, slow to stop.
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export function createCameraFollow(camera: THREE.Camera): CameraFollow {
  const restQuaternion = camera.quaternion.clone();
  const restPosition = camera.position.clone();
  let target: THREE.Vector3 | null = null;
  // A new target waiting out the delay before the camera moves.
  let upcoming: { point: THREE.Vector3 | null; wait: number; seconds: number | undefined } | null = null;
  let turn: Turn | null = null;
  // Waiting for the camera to reach the current target.
  let arrivals: Array<() => void> = [];
  const arrived = () => {
    const done = arrivals;
    arrivals = [];
    done.forEach((callback) => callback());
  };
  // Where this last put the camera, to notice anything else moving it.
  const lastQuaternion = camera.quaternion.clone();
  const lastPosition = camera.position.clone();

  const samePoint = (a: THREE.Vector3 | null, b: THREE.Vector3 | null) =>
    a === null ? b === null : b !== null && a.equals(b);

  const WORLD_UP = new THREE.Vector3(0, 1, 0);

  // The normal place, turned about the vertical axis alone by CAMERA_FOLLOW.amount
  // of the way toward facing the target: the camera's pitch and roll stay as
  // they are at rest, so only its heading changes.
  const destination = () => {
    const quaternion = restQuaternion.clone();
    if (target) {
      const parentQuaternion = camera.parent
        ? camera.parent.getWorldQuaternion(new THREE.Quaternion())
        : new THREE.Quaternion();
      const eye = camera.parent ? camera.parent.localToWorld(restPosition.clone()) : restPosition.clone();
      const restWorld = parentQuaternion.clone().multiply(restQuaternion);
      // Flattened onto the ground, the way the camera faces at rest and the
      // way the target lies from it.
      const flat = (v: THREE.Vector3) => v.setY(0).normalize();
      const facing = flat(new THREE.Vector3(0, 0, -1).applyQuaternion(restWorld));
      const toTarget = flat(target.clone().sub(eye));
      if (facing.lengthSq() > 0 && toTarget.lengthSq() > 0) {
        const angle = Math.atan2(facing.clone().cross(toTarget).y, facing.dot(toTarget));
        const yaw = new THREE.Quaternion().setFromAxisAngle(WORLD_UP, angle * CAMERA_FOLLOW.amount);
        // Turn in the world, then express it relative to any parent.
        quaternion.copy(parentQuaternion.clone().invert().multiply(yaw).multiply(restWorld));
      }
    }
    return { quaternion, position: restPosition.clone() };
  };

  let nextSeconds: number | undefined;
  const startTurn = (): Turn => {
    const to = destination();
    return {
      fromQuaternion: camera.quaternion.clone(),
      fromPosition: camera.position.clone(),
      toQuaternion: to.quaternion,
      toPosition: to.position,
      elapsed: 0,
      seconds: nextSeconds,
    };
  };

  const flatForward = (quaternion: THREE.Quaternion) =>
    new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion).setY(0).normalize();

  return {
    yaw() {
      const parent = camera.parent
        ? camera.parent.getWorldQuaternion(new THREE.Quaternion())
        : new THREE.Quaternion();
      const from = flatForward(parent.clone().multiply(restQuaternion));
      const to = flatForward(parent.clone().multiply(camera.quaternion));
      if (from.lengthSq() === 0 || to.lengthSq() === 0) return 0;
      return Math.atan2(from.clone().cross(to).y, from.dot(to));
    },

    captureRest() {
      restQuaternion.copy(camera.quaternion);
      restPosition.copy(camera.position);
      lastQuaternion.copy(camera.quaternion);
      lastPosition.copy(camera.position);
      turn = null;
    },

    setTarget(point, onArrive, seconds) {
      if (samePoint(upcoming ? upcoming.point : target, point)) {
        if (onArrive) arrivals.push(onArrive);
        return;
      }
      // Anyone waiting on the old target stops waiting.
      arrived();
      if (onArrive) arrivals.push(onArrive);
      // A further change during the pause restarts it, so only the latest
      // target is turned to.
      upcoming = { point: point ? point.clone() : null, wait: paced(CAMERA_FOLLOW.delaySeconds), seconds };
    },

    update(deltaSeconds) {
      const movedElsewhere =
        camera.quaternion.angleTo(lastQuaternion) > 1e-5 || camera.position.distanceTo(lastPosition) > 1e-5;
      if (turn && movedElsewhere) turn = startTurn();

      if (upcoming) {
        upcoming.wait -= deltaSeconds;
        if (upcoming.wait <= 0) {
          target = upcoming.point;
          nextSeconds = upcoming.seconds;
          upcoming = null;
          turn = startTurn();
        }
      }

      if (!turn) {
        const to = destination();
        const settled =
          camera.quaternion.angleTo(to.quaternion) < 1e-4 && camera.position.distanceTo(to.position) < 1e-4;
        if (settled) {
          arrived();
          return;
        }
        turn = startTurn();
      }

      turn.elapsed += deltaSeconds;
      // The head turn, at the game's pace. Read per frame, so a pace that
      // changes mid-turn just finishes the turn faster.
      const progress = Math.min(1, turn.elapsed / Math.max(paced(turn.seconds ?? CAMERA_FOLLOW.turnSeconds), 1e-6));
      const eased = easeInOut(progress);
      camera.position.lerpVectors(turn.fromPosition, turn.toPosition, eased);
      camera.quaternion.slerpQuaternions(turn.fromQuaternion, turn.toQuaternion, eased);
      lastQuaternion.copy(camera.quaternion);
      lastPosition.copy(camera.position);
      if (progress >= 1) {
        turn = null;
        if (!upcoming) arrived();
      }
    },
  };
}
