import * as THREE from "three";
import type { BlindCards } from "./blind-cards";
import { CARD_HANDLING } from "./config";

export interface BlindCardControlsOptions {
  canvas: HTMLCanvasElement;
  camera: THREE.Camera;
  blind: BlindCards;
  // Keeps the orbit controls still while your card has the pointer.
  holdOrbit(held: boolean): void;
  // Whether your card may be played right now.
  canPlay(): boolean;
  // Where your hand's play line is, in world space: a card dropped above it on
  // screen is played, as it is from your hand (CARD_HANDLING.playLineLengths).
  playLine(): THREE.Vector3 | null;
  // Sends your card as your play; false if it couldn't be sent.
  onPlay(): boolean;
}

export interface BlindCardControls {
  dispose(): void;
}

interface Press {
  pointerId: number;
  x: number;
  y: number;
  dragging: boolean;
  plane: THREE.Plane;
  offset: THREE.Vector3;
}

// Your card in a blind round can't be read or arranged, only played, either
// way your hand's cards are: click or tap it, or drag it above the play line
// and drop it. Dropped short, it goes back to your forehead. Elsewhere the
// pointer is left alone, so the orbit controls carry on as normal.
export function createBlindCardControls(options: BlindCardControlsOptions): BlindCardControls {
  const { canvas, camera, blind } = options;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let press: Press | null = null;

  const aim = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
  };

  const hits = (event: PointerEvent) => {
    aim(event);
    return blind.localCardAt(raycaster);
  };

  const inPlayArea = (event: PointerEvent) => {
    const line = options.playLine();
    if (!line) return false;
    const rect = canvas.getBoundingClientRect();
    const y = rect.top + ((1 - line.clone().project(camera).y) / 2) * rect.height;
    return event.clientY < y - CARD_HANDLING.playAreaMarginPx;
  };

  const play = () => {
    blind.play();
    if (!options.onPlay()) blind.cancelPlay();
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || press || !hits(event)) return;
    // The press belongs to the card, not to the orbit controls underneath.
    event.stopImmediatePropagation();
    options.holdOrbit(true);
    canvas.setPointerCapture(event.pointerId);

    const position = blind.localPosition() ?? new THREE.Vector3();
    const facing = camera.getWorldDirection(new THREE.Vector3()).negate();
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(facing, position);
    const grab = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
    press = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      dragging: false,
      plane,
      offset: grab ? position.clone().sub(grab) : new THREE.Vector3(),
    };
  };

  // The hand's controls clear the cursor on every move away from their cards,
  // so it is set again on every move over yours, and cleared only on leaving it.
  let hovering = false;
  const onPointerMove = (event: PointerEvent) => {
    if (press) {
      if (event.pointerId !== press.pointerId) return;
      const travelled = Math.hypot(event.clientX - press.x, event.clientY - press.y);
      if (!press.dragging && travelled < CARD_HANDLING.dragThresholdPx) return;
      if (!press.dragging) {
        press.dragging = true;
        blind.startDrag();
      }
      aim(event);
      const point = raycaster.ray.intersectPlane(press.plane, new THREE.Vector3());
      if (point) blind.dragTo(point.add(press.offset));
      return;
    }

    const over = hits(event) && options.canPlay();
    blind.setLocalHovered(over);
    if (over) canvas.style.cursor = "pointer";
    else if (hovering) canvas.style.cursor = "";
    hovering = over;
  };

  const finish = (event: PointerEvent, cancelled: boolean) => {
    if (!press || event.pointerId !== press.pointerId) return;
    const { dragging } = press;
    press = null;
    options.holdOrbit(false);
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);

    if (!dragging) {
      if (!cancelled && options.canPlay()) play();
      return;
    }
    if (!cancelled && inPlayArea(event) && options.canPlay()) {
      play();
      return;
    }
    blind.endDrag();
  };

  const onPointerUp = (event: PointerEvent) => finish(event, false);
  const onPointerCancel = (event: PointerEvent) => finish(event, true);

  // Capture phase, so a press on the card is claimed before OrbitControls sees it.
  canvas.addEventListener("pointerdown", onPointerDown, { capture: true });
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerCancel);

  return {
    dispose() {
      canvas.removeEventListener("pointerdown", onPointerDown, { capture: true });
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerCancel);
    },
  };
}
