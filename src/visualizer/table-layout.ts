import * as THREE from "three";
import { SEAT_IDS, type SeatId } from "./player-characters";
import { numberedNodes, placementOf, type Placement } from "./placement";

export interface TableLayout {
  // Your hand targets, card01..card20 (card01 at the right). Use centredSlots
  // to pick the ones a hand of a given size sits on.
  readonly localHand: readonly Placement[];
  // Played-card targets, played-card-1..6.
  readonly played: readonly Placement[];
  readonly trump: Placement | null;
  // The card stack, bottom card first (stack-card-01..60).
  readonly stack: readonly Placement[];
  // The other seats in clockwise order seen from above, starting on your left:
  // the way play and dealing pass around the table.
  readonly clockwiseSeats: readonly SeatId[];
  // Your hand targets turned about the table's centre to face a seat.
  handFor(seat: SeatId): readonly Placement[];
}

// The middle `count` slots of a card set, so a hand sits centred on the fan:
// with 20 slots, 1 card uses card10, and 4 cards use card09 to card12. The
// first slot is floor((slots - count) / 2); an odd spare slot goes on the high
// numbered side.
export function centredSlots<T>(slots: readonly T[], count: number): readonly T[] {
  const shown = Math.max(0, Math.min(count, slots.length));
  const start = Math.floor((slots.length - shown) / 2);
  return slots.slice(start, start + shown);
}

const UP = new THREE.Vector3(0, 1, 0);
const TAU = Math.PI * 2;
// Angle about the table's vertical axis; rotating about +Y by d adds d to it.
const angleOf = (position: THREE.Vector3) => Math.atan2(position.x, position.z);

// Everything positional about the table, read from the targets in Wizard.glb.
// Targets only mark where cards go, so their placeholder cards are hidden here.
// Angles are measured about the table's centre, which is the scene origin.
export function createTableLayout(environment: THREE.Object3D): TableLayout {
  environment.updateMatrixWorld(true);

  const targets = (pattern: RegExp) => {
    const nodes = numberedNodes(environment, pattern);
    for (const node of nodes) node.visible = false;
    return nodes.map((node) => placementOf(node, environment));
  };

  const localHand = targets(/^card(\d+)$/);
  const played = targets(/^played-card-(\d+)$/);
  const stack = targets(/^stack-card-(\d+)$/);
  const trumpNode = environment.getObjectByName("trump-card") ?? null;
  if (trumpNode) trumpNode.visible = false;
  const trump = trumpNode ? placementOf(trumpNode, environment) : null;

  // Your seat has no target of its own; your hand set shows where it is.
  const handCentre = localHand
    .reduce((sum, slot) => sum.add(slot.position), new THREE.Vector3())
    .divideScalar(Math.max(localHand.length, 1));
  const localAngle = angleOf(handCentre);

  const seatAngles = new Map<SeatId, number>();
  for (const seat of SEAT_IDS) {
    const node = environment.getObjectByName(`seat${seat}`);
    if (node) seatAngles.set(seat, angleOf(placementOf(node, environment).position));
  }

  // Seen from above, clockwise from your seat means decreasing angle.
  const clockwiseFromLocal = (seat: SeatId) =>
    (((localAngle - (seatAngles.get(seat) ?? localAngle)) % TAU) + TAU) % TAU;
  const clockwiseSeats = [...seatAngles.keys()].sort(
    (a, b) => clockwiseFromLocal(a) - clockwiseFromLocal(b),
  );

  const hands = new Map<SeatId, Placement[]>();

  return {
    localHand,
    played,
    trump,
    stack,
    clockwiseSeats,

    handFor(seat) {
      let hand = hands.get(seat);
      if (!hand) {
        const turn = new THREE.Quaternion().setFromAxisAngle(
          UP,
          (seatAngles.get(seat) ?? localAngle) - localAngle,
        );
        hand = localHand.map((slot) => ({
          position: slot.position.clone().applyQuaternion(turn),
          quaternion: turn.clone().multiply(slot.quaternion),
          scale: slot.scale.clone(),
        }));
        hands.set(seat, hand);
      }
      return hand;
    },
  };
}
