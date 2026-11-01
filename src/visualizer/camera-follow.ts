import * as THREE from "three";
import { CAMERA_FOLLOW, LOOK_AROUND } from "./config";
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
  // The turn from the normal view that would face this point, the same way
  // a turn toward a player is worked out.
  yawToward(point: THREE.Vector3): number;
  // You looking around (look-around.ts): the camera shows this turn from the
  // normal view instead of the one it follows, easing over to it; null eases
  // back. The follow carries on underneath, so whoever waits on it is not
  // kept waiting.
  look(yaw: number | null): void;
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
  // The heading the follow has the camera at; what is shown is this, eased
  // toward your look while you look around.
  const pose = camera.quaternion.clone();
  let lookYaw: number | null = null;
  let shownLookYaw = 0;
  let lookWeight = 0;
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

  const parentQuaternion = () =>
    camera.parent ? camera.parent.getWorldQuaternion(new THREE.Quaternion()) : new THREE.Quaternion();

  // CAMERA_FOLLOW.amount of the turn from the normal view that faces this
  // point, about the vertical axis alone.
  const yawToward = (point: THREE.Vector3): number => {
    const eye = camera.parent ? camera.parent.localToWorld(restPosition.clone()) : restPosition.clone();
    const restWorld = parentQuaternion().multiply(restQuaternion);
    // Flattened onto the ground, the way the camera faces at rest and the
    // way the point lies from it.
    const flat = (v: THREE.Vector3) => v.setY(0).normalize();
    const facing = flat(new THREE.Vector3(0, 0, -1).applyQuaternion(restWorld));
    const toPoint = flat(point.clone().sub(eye));
    if (facing.lengthSq() === 0 || toPoint.lengthSq() === 0) return 0;
    return Math.atan2(facing.clone().cross(toPoint).y, facing.dot(toPoint)) * CAMERA_FOLLOW.amount;
  };

  // The normal view turned this far about the vertical axis: the camera's
  // pitch and roll stay as they are at rest, so only its heading changes.
  const atYaw = (angle: number): THREE.Quaternion => {
    if (angle === 0) return restQuaternion.clone();
    const parent = parentQuaternion();
    const turn = new THREE.Quaternion().setFromAxisAngle(WORLD_UP, angle);
    // Turn in the world, then express it relative to any parent.
    return parent.clone().invert().multiply(turn).multiply(parent.multiply(restQuaternion));
  };

  // The normal place, turned toward the target.
  const destination = () => ({
    quaternion: atYaw(target ? yawToward(target) : 0),
    position: restPosition.clone(),
  });

  // What the camera shows: the follow's heading, eased toward your look.
  const show = (deltaSeconds: number) => {
    const want = lookYaw === null ? 0 : 1;
    const rate = lookYaw === null ? LOOK_AROUND.easeBackPerSecond : LOOK_AROUND.easeInPerSecond;
    const ease = 1 - Math.exp(-rate * deltaSeconds);
    lookWeight += (want - lookWeight) * ease;
    if (Math.abs(want - lookWeight) < 1e-3) lookWeight = want;
    if (lookYaw !== null) shownLookYaw += (lookYaw - shownLookYaw) * ease;
    camera.quaternion.copy(pose);
    if (lookWeight > 0) camera.quaternion.slerp(atYaw(shownLookYaw), lookWeight);
    lastQuaternion.copy(camera.quaternion);
  };

  let nextSeconds: number | undefined;
  const startTurn = (): Turn => {
    const to = destination();
    return {
      fromQuaternion: pose.clone(),
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

    yawToward,

    look(yaw) {
      // Starting to look: from wherever the camera is facing now.
      if (lookYaw === null && yaw !== null && lookWeight === 0) shownLookYaw = this.yaw();
      lookYaw = yaw;
    },

    captureRest() {
      pose.copy(camera.quaternion);
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
      // Something else moved the camera (orbiting): follow on from there.
      if (movedElsewhere) {
        pose.copy(camera.quaternion);
        lookWeight = 0;
        if (turn) turn = startTurn();
      }

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
          pose.angleTo(to.quaternion) < 1e-4 && camera.position.distanceTo(to.position) < 1e-4;
        if (settled) {
          arrived();
          show(deltaSeconds);
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
      pose.slerpQuaternions(turn.fromQuaternion, turn.toQuaternion, eased);
      lastPosition.copy(camera.position);
      show(deltaSeconds);
      if (progress >= 1) {
        turn = null;
        if (!upcoming) arrived();
      }
    },
  };
}
