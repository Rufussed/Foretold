import * as THREE from "three";
import type { CardFactory, CardObject } from "./card-objects";
import { THIEF } from "./config";
import { paced } from "./pace";
import { applyPlacement, type Placement } from "./placement";

export interface ThiefFlights {
  // Flies a new card from one place to another: rising, then passing to one
  // side of the card going the other way (`side` -1 is the viewer's left, 1
  // their right), then settling.
  // The places are asked for every frame, since a fan may still be moving.
  fly(options: {
    texture: THREE.Texture;
    from(): Placement | null;
    to(): Placement | null;
    side: 1 | -1;
    done(): void;
  }): void;
  update(deltaSeconds: number): void;
  dispose(): void;
}

interface Flight {
  card: CardObject;
  elapsed: number;
  seconds: number;
  options: Parameters<ThiefFlights["fly"]>[0];
}

const smooth = (x: number) => x * x * (3 - 2 * x);

// The cards a Thief trades, flying between the two hands. They are copies
// made for the flight and thrown away at the end; the real cards appear in
// their new hands as these land.
export function createThiefFlights(
  environment: THREE.Object3D,
  factory: CardFactory,
  camera: THREE.Camera,
): ThiefFlights {
  const flights = new Set<Flight>();
  const up = new THREE.Vector3(0, 1, 0).transformDirection(environment.matrixWorld.clone().invert());
  let count = 0;

  // The camera's right, flattened onto the table, in environment space.
  const viewerRight = () => {
    const right = new THREE.Vector3(1, 0, 0)
      .applyQuaternion(camera.getWorldQuaternion(new THREE.Quaternion()))
      .transformDirection(environment.matrixWorld.clone().invert());
    return right.addScaledVector(up, -right.dot(up)).normalize();
  };

  // A card's own long axis, pointing up from the table: the way it rises out of
  // a fan and drops back into one.
  const alongOf = (quaternion: THREE.Quaternion) => {
    const along = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion);
    if (along.dot(up) < 0) along.negate();
    // Never so flat that the rise runs away.
    return along.multiplyScalar(1 / Math.max(along.dot(up), 0.25));
  };

  // The flight in five legs: up along the card's own long axis, turn flat and
  // face down, travel flat to above its place, turn to face the way it will lie,
  // and drop along its long axis into place. Its sideways offset (to its own
  // side of the card passing the other way) holds while it is flat.
  const place = (flight: Flight, t: number, from: Placement, to: Placement) => {
    const length = factory.length * from.scale.z;
    const width = factory.width * from.scale.x;
    const lift = THIEF.swapArcLengths * length;
    const startApex = from.position.clone().addScaledVector(alongOf(from.quaternion), lift);
    const endApex = to.position.clone().addScaledVector(alongOf(to.quaternion), lift);

    // Flat and face down, its long axis pointing the way it is travelling.
    const heading = endApex.clone().sub(startApex);
    heading.addScaledVector(up, -heading.dot(up));
    if (heading.lengthSq() < 1e-12) heading.copy(viewerRight().cross(up));
    heading.normalize();
    const faceDown = up.clone().negate();
    const flat = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(faceDown.clone().cross(heading), faceDown, heading),
    );

    const [rise, turn, travel, settle] = THIEF.swapLegs;
    const leg = (start: number, length: number) => smooth(Math.min(Math.max((t - start) / length, 0), 1));
    const { object } = flight.card;
    let side = 0;

    if (t < rise) {
      object.position.lerpVectors(from.position, startApex, leg(0, rise));
      object.quaternion.copy(from.quaternion);
    } else if (t < rise + turn) {
      object.position.copy(startApex);
      side = leg(rise, turn);
      object.quaternion.slerpQuaternions(from.quaternion, flat, side);
    } else if (t < rise + turn + travel) {
      object.position.lerpVectors(startApex, endApex, leg(rise + turn, travel));
      object.quaternion.copy(flat);
      side = 1;
    } else if (t < rise + turn + travel + settle) {
      object.position.copy(endApex);
      side = 1 - leg(rise + turn + travel, settle);
      object.quaternion.slerpQuaternions(flat, to.quaternion, leg(rise + turn + travel, settle));
    } else {
      object.position.lerpVectors(endApex, to.position, leg(rise + turn + travel + settle, 1 - rise - turn - travel - settle));
      object.quaternion.copy(to.quaternion);
    }

    object.position.addScaledVector(viewerRight(), side * THIEF.swapPassWidths * width * flight.options.side);
    object.scale.lerpVectors(from.scale, to.scale, smooth(t));
  };

  const remove = (flight: Flight) => {
    flights.delete(flight);
    flight.card.object.visible = false;
    flight.card.object.removeFromParent();
  };

  return {
    fly(options) {
      const card = factory.build(`thief-flight-${++count}`, options.texture);
      const flight: Flight = { card, elapsed: 0, seconds: paced(THIEF.swapSeconds), options };
      const from = options.from();
      if (from) applyPlacement(card.object, from);
      card.object.visible = !!from;
      flights.add(flight);
    },

    update(deltaSeconds) {
      for (const flight of [...flights]) {
        flight.elapsed += deltaSeconds;
        const from = flight.options.from();
        const to = flight.options.to();
        if (from && to) {
          flight.card.object.visible = true;
          place(flight, Math.min(flight.elapsed / flight.seconds, 1), from, to);
        }
        if (flight.elapsed >= flight.seconds) {
          remove(flight);
          flight.options.done();
        }
      }
    },

    dispose() {
      for (const flight of [...flights]) remove(flight);
    },
  };
}
