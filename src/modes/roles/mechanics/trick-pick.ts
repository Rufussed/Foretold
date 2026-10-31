import * as THREE from "three";
import type { TableCards } from "../../../visualizer/table-cards";

// Roles mode only. Picking a card in the trick on the table itself, for the
// Fisher's catch (fish-pick.ts) and the Thief's trump 1 (steal-pick.ts): the
// cards that may be picked rise off the table, as a hand card does when
// pressed; pointing at one outlines it; clicking one sets them all down again,
// and once they have settled the pick is handed on, so the swap that follows
// starts from the table (trick-swap.ts). While the cards are up, a label just
// below them says what to do ("Hook a card", "Steal a card"), with a button
// beside it when there is another way out (the Duke's "Keep it"). No other
// mode uses this.

export const TRICK_PICK = {
  // How long the cards take to settle back before the pick is handed on, in
  // seconds.
  settleSeconds: 0.35,
};

export interface TrickPick {
  // Raises these trick cards to be picked, with this label under them;
  // onPick gets the key clicked once they have settled back. Raising again
  // replaces any pick still open. With an action, a button beside the label
  // sets the cards down and calls it instead.
  raise(
    keys: readonly string[],
    label: string,
    onPick: (key: string) => void,
    action?: { text: string; onClick: () => void },
  ): void;
  // Sets the cards down with no pick made.
  clear(): void;
  // True while cards are up: the hand's controls stand aside.
  picking(): boolean;
  dispose(): void;
}

export interface TrickPickOptions {
  canvas: HTMLCanvasElement;
  camera: THREE.Camera;
  cards: TableCards;
  // Where the label goes: the game page, over the canvas.
  page: HTMLElement;
}

export function createTrickPick({ canvas, camera, cards, page }: TrickPickOptions): TrickPick {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let raised = new Set<string>();
  let onPicked: ((key: string) => void) | null = null;
  let timer = 0;

  const label = document.createElement("div");
  label.className = "trick-pick-label";
  label.hidden = true;
  const text = document.createElement("span");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "trick-pick-action";
  label.append(text, button);
  page.append(label);
  let onAction: (() => void) | null = null;
  button.addEventListener("click", () => {
    const act = onAction;
    setDown();
    act?.();
  });

  // The label follows the raised cards: centred under them, just below the
  // lowest edge any of them shows on screen.
  const box = new THREE.Box3();
  const corner = new THREE.Vector3();
  let frame = 0;
  const follow = () => {
    frame = requestAnimationFrame(follow);
    if (!raised.size) return;
    const rect = canvas.getBoundingClientRect();
    const pageRect = page.getBoundingClientRect();
    let left = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (const { key, object } of cards.trickCardObjects()) {
      if (!raised.has(key)) continue;
      box.setFromObject(object);
      for (let i = 0; i < 8; i++) {
        corner.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
        corner.project(camera);
        const x = rect.left + ((corner.x + 1) / 2) * rect.width;
        const y = rect.top + ((1 - corner.y) / 2) * rect.height;
        left = Math.min(left, x);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
    if (!Number.isFinite(bottom)) return;
    label.style.left = `${(left + right) / 2 - pageRect.left}px`;
    label.style.top = `${bottom - pageRect.top + 12}px`;
  };
  frame = requestAnimationFrame(follow);

  const setDown = () => {
    raised = new Set();
    onPicked = null;
    onAction = null;
    cards.setTrickRaised([]);
    cards.setHovered(null);
    canvas.style.cursor = "";
    label.hidden = true;
  };

  const aim = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!raised.size) return;
    aim(event);
    const key = cards.trickCardAt(raycaster, raised);
    cards.setHovered(key);
    canvas.style.cursor = key ? "pointer" : "";
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || !raised.size) return;
    aim(event);
    const key = cards.trickCardAt(raycaster, raised);
    const picked = onPicked;
    if (!key || !picked) return;
    event.stopImmediatePropagation();
    setDown();
    timer = window.setTimeout(() => picked(key), TRICK_PICK.settleSeconds * 1000);
  };

  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerdown", onPointerDown, { capture: true });

  return {
    raise(keys, says, onPick, action) {
      window.clearTimeout(timer);
      raised = new Set(keys);
      onPicked = onPick;
      onAction = action?.onClick ?? null;
      cards.setTrickRaised(keys);
      text.textContent = says;
      button.textContent = action?.text ?? "";
      button.hidden = !action;
      label.hidden = false;
    },

    clear() {
      window.clearTimeout(timer);
      if (raised.size) setDown();
    },

    picking: () => raised.size > 0,

    dispose() {
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
      label.remove();
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerdown", onPointerDown, { capture: true });
      setDown();
    },
  };
}
