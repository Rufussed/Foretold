import * as THREE from "three";
import { CARD_HANDLING } from "./config";
import type { TableCards } from "./table-cards";

export interface CardControlsOptions {
  canvas: HTMLCanvasElement;
  camera: THREE.Camera;
  cards: TableCards;
  // Keeps the orbit controls still while a card has the pointer.
  holdOrbit(held: boolean): void;
  // Whether a card dropped on the play area may be played right now.
  canPlay(): boolean;
  // A card has gone from the hand to the play area.
  onPlay(key: string): void;
}

export interface CardControls {
  dispose(): void;
}

interface Press {
  key: string;
  pointerId: number;
  x: number;
  y: number;
  dragging: boolean;
  plane: THREE.Plane;
  offset: THREE.Vector3;
}

// Pointer handling for your hand on the scene canvas. Hovering outlines a card.
// A click raises it to be read and another click lowers it. Dragging sideways
// moves it within the hand; dropping it above the raised cards plays it, if
// playing is allowed. Reading and rearranging work at any time.
export function createCardControls(options: CardControlsOptions): CardControls {
  const { canvas, camera, cards } = options;
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

  const toScreen = (world: THREE.Vector3) => {
    const rect = canvas.getBoundingClientRect();
    const ndc = world.clone().project(camera);
    return {
      x: rect.left + ((ndc.x + 1) / 2) * rect.width,
      y: rect.top + ((1 - ndc.y) / 2) * rect.height,
    };
  };

  // Anywhere above where the raised cards sit counts as the play area.
  const inPlayArea = (event: PointerEvent) => {
    const targets = cards.handTargets();
    if (!targets.length) return false;
    const line = Math.min(...targets.map((target) => toScreen(target.raised).y));
    return event.clientY < line - CARD_HANDLING.playAreaMarginPx;
  };

  // The hand position whose slot is closest sideways to the pointer.
  const nearestHandIndex = (clientX: number) => {
    let best = -1;
    let bestDistance = Infinity;
    cards.handTargets().forEach((target, index) => {
      const distance = Math.abs(toScreen(target.home).x - clientX);
      if (distance < bestDistance) {
        best = index;
        bestDistance = distance;
      }
    });
    return best;
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || press) return;
    aim(event);
    const key = cards.cardAt(raycaster);
    if (!key) return;

    // The press belongs to the card, not to the orbit controls underneath.
    event.stopImmediatePropagation();
    options.holdOrbit(true);
    canvas.setPointerCapture(event.pointerId);

    const position = cards.positionOf(key) ?? new THREE.Vector3();
    const facing = camera.getWorldDirection(new THREE.Vector3()).negate();
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(facing, position);
    const grab = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
    press = {
      key,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      dragging: false,
      plane,
      offset: grab ? position.clone().sub(grab) : new THREE.Vector3(),
    };
    cards.setHovered(key);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (press) {
      if (event.pointerId !== press.pointerId) return;
      const travelled = Math.hypot(event.clientX - press.x, event.clientY - press.y);
      if (!press.dragging && travelled < CARD_HANDLING.dragThresholdPx) return;
      if (!press.dragging) {
        press.dragging = true;
        cards.startDrag(press.key);
      }

      aim(event);
      const point = raycaster.ray.intersectPlane(press.plane, new THREE.Vector3());
      if (point) cards.dragTo(press.key, point.add(press.offset));

      if (!inPlayArea(event)) {
        const index = nearestHandIndex(event.clientX);
        if (index !== -1) cards.moveInHand(press.key, index);
      }
      return;
    }

    aim(event);
    const key = cards.cardAt(raycaster);
    cards.setHovered(key);
    canvas.style.cursor = key ? "pointer" : "";
  };

  const finish = (event: PointerEvent, cancelled: boolean) => {
    if (!press || event.pointerId !== press.pointerId) return;
    const { key, dragging } = press;
    press = null;
    options.holdOrbit(false);
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }

    if (!dragging) {
      if (!cancelled) cards.toggleRaised(key);
      return;
    }

    if (!cancelled && inPlayArea(event) && options.canPlay() && cards.play(key)) {
      options.onPlay(key);
      return;
    }
    cards.endDrag(key);
  };

  const onPointerUp = (event: PointerEvent) => finish(event, false);
  const onPointerCancel = (event: PointerEvent) => finish(event, true);
  const onPointerLeave = () => {
    if (!press) cards.setHovered(null);
  };

  // Capture phase, so a press on a card is claimed before OrbitControls sees it.
  canvas.addEventListener("pointerdown", onPointerDown, { capture: true });
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerCancel);
  canvas.addEventListener("pointerleave", onPointerLeave);

  return {
    dispose() {
      canvas.removeEventListener("pointerdown", onPointerDown, { capture: true });
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerCancel);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.style.cursor = "";
    },
  };
}
