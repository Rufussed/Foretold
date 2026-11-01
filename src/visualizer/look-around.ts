import { LOOK_AROUND } from "./config";

export interface LookAround {
  dispose(): void;
}

export interface LookAroundOptions {
  canvas: HTMLCanvasElement;
  // How far the camera is turned now, and turns it to look (null hands it
  // back to the turn it follows); see three-scene.ts.
  cameraYaw(): number;
  look(yaw: number | null): void;
  // The furthest the camera turns either way to face a player, [right, left]
  // in radians; you look no further than that.
  range(): [number, number];
}

const DEGREES = Math.PI / 180;

// You turning the camera left and right yourself, within the turn it makes
// toward the players: the mouse at the left or right edge of the screen, or
// dragging with the right mouse button held, or with two fingers. Letting go,
// or leaving the edge, hands the camera back to the turn it follows, which
// carried on meanwhile (camera-follow.ts).
export function createLookAround(options: LookAroundOptions): LookAround {
  const { canvas } = options;
  // -1 at the right edge, 1 at the left, 0 elsewhere: the way the view turns
  // (a turn to the left is positive).
  let edge = 0;
  let yaw = 0;
  let looking = false;
  // A drag in progress: where it started on screen, and the turn then.
  let drag: { x: number; yaw: number } | null = null;

  const clamp = (value: number) => {
    const [low, high] = options.range();
    return Math.min(high, Math.max(low, value));
  };

  const start = () => {
    if (!looking) yaw = options.cameraYaw();
    looking = true;
  };
  const stop = () => {
    if (!looking) return;
    looking = false;
    options.look(null);
  };

  const dragTo = (x: number) => {
    if (!drag) return;
    // Dragging to the right looks to the right.
    const turned = ((x - drag.x) / Math.max(canvas.clientWidth, 1)) * LOOK_AROUND.dragDegreesPerScreen * DEGREES;
    yaw = clamp(drag.yaw - turned);
    options.look(yaw);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (drag && event.pointerType === "mouse") {
      dragTo(event.clientX);
      return;
    }
    // Only a mouse with no button held looks from the edge: a card being
    // dragged to the side never turns the view.
    if (event.pointerType !== "mouse" || event.buttons !== 0) {
      edge = 0;
      return;
    }
    const box = canvas.getBoundingClientRect();
    const wasAtEdge = edge !== 0;
    edge = event.clientX - box.left <= LOOK_AROUND.edgePx ? 1 : box.right - event.clientX <= LOOK_AROUND.edgePx ? -1 : 0;
    if (edge && !wasAtEdge) start();
    if (!edge && wasAtEdge && !drag) stop();
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType !== "mouse" || event.button !== 2) return;
    start();
    drag = { x: event.clientX, yaw };
  };

  const onPointerUp = (event: PointerEvent) => {
    if (event.pointerType !== "mouse" || event.button !== 2 || !drag) return;
    drag = null;
    if (!edge) stop();
  };

  const onLeave = () => {
    edge = 0;
    if (!drag) stop();
  };

  // The right button turns the view, so it opens no menu over the table.
  const onContextMenu = (event: Event) => event.preventDefault();

  // Two fingers: their middle drags the view the same way.
  const middle = (touches: TouchList) => (touches[0]!.clientX + touches[1]!.clientX) / 2;
  const onTouchStart = (event: TouchEvent) => {
    if (event.touches.length !== 2) return;
    start();
    drag = { x: middle(event.touches), yaw };
  };
  const onTouchMove = (event: TouchEvent) => {
    if (event.touches.length === 2 && drag) dragTo(middle(event.touches));
  };
  const onTouchEnd = (event: TouchEvent) => {
    if (event.touches.length >= 2 || !drag) return;
    drag = null;
    stop();
  };

  // At an edge, the view keeps turning while the mouse stays there.
  let frame = 0;
  let last = performance.now();
  const tick = (now: number) => {
    frame = requestAnimationFrame(tick);
    const seconds = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (!edge || drag) return;
    yaw = clamp(yaw + edge * LOOK_AROUND.edgeDegreesPerSecond * DEGREES * seconds);
    options.look(yaw);
  };
  frame = requestAnimationFrame(tick);

  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointerleave", onLeave);
  canvas.addEventListener("contextmenu", onContextMenu);
  canvas.addEventListener("touchstart", onTouchStart, { passive: true });
  canvas.addEventListener("touchmove", onTouchMove, { passive: true });
  canvas.addEventListener("touchend", onTouchEnd);
  canvas.addEventListener("touchcancel", onTouchEnd);

  return {
    dispose() {
      cancelAnimationFrame(frame);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("contextmenu", onContextMenu);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
      canvas.removeEventListener("touchcancel", onTouchEnd);
      options.look(null);
    },
  };
}
