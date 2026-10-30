import * as THREE from "three";
import type { PublicWizardGameState } from "../../../../backend/src/game/wizard/models/wizardGame";
import type { CardObject } from "../../../visualizer/card-objects";
import type { SeatId } from "../../../visualizer/player-characters";

// A Roles game's Blue Wizard sees how many blue cards each hidden hand holds
// (backend modes/roles/blueWizard.ts sends the counts to them alone). That
// many cards of each opponent's fan, and their own blind card if it is blue,
// are tinted blue on both sides. Which cards in a fan carry it means nothing:
// the fan is only as many face-down cards as the player holds.

export const BLUE_SIGHT = {
  // Multiplied into the card's front.
  tint: "#3f7dff",
  // The back's wash: its art takes this hue, and its darks are lifted towards
  // `lift` by `liftStrength` (0 to 1), so even the black back reads blue.
  wash: "#2f6bff",
  lift: "#1d4fd6",
  liftStrength: 0.55,
};

// The back's art washed blue, made once from the shared back once its image
// has arrived; null until then.
let washedBack: THREE.Texture | null = null;
function blueBack(base: THREE.Texture): THREE.Texture | null {
  if (washedBack) return washedBack;
  const image = base.image as (CanvasImageSource & { width: number; height: number }) | undefined;
  if (!image?.width) return null;
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(image, 0, 0);
  context.globalCompositeOperation = "color";
  context.fillStyle = BLUE_SIGHT.wash;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.globalCompositeOperation = "screen";
  context.globalAlpha = BLUE_SIGHT.liftStrength;
  context.fillStyle = BLUE_SIGHT.lift;
  context.fillRect(0, 0, canvas.width, canvas.height);
  washedBack = new THREE.CanvasTexture(canvas);
  washedBack.colorSpace = base.colorSpace;
  washedBack.flipY = base.flipY;
  washedBack.anisotropy = base.anisotropy;
  return washedBack;
}

// The material names on the card mesh (see card-objects.ts).
const BACK_MATERIAL_NAME = "Card Back";

interface Tinted {
  // The shared back material each back mesh had before it took a blue copy.
  backs: Map<THREE.Mesh, THREE.Material>;
}

const tinted = new WeakMap<CardObject, Tinted>();

// Tints one card blue, front and back, or puts it back as it was.
export function setBlueTint(card: CardObject, blue: boolean): void {
  const was = tinted.get(card);
  if (blue === !!was) return;

  if (blue) {
    const meshes: THREE.Mesh[] = [];
    card.object.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh && !Array.isArray(mesh.material) && mesh.material.name === BACK_MATERIAL_NAME) meshes.push(mesh);
    });
    // Until the back's art has arrived there is nothing to wash: tried again
    // next frame.
    const base = (meshes[0]?.material as THREE.MeshBasicMaterial | undefined)?.map;
    const washed = base ? blueBack(base) : null;
    if (meshes.length > 0 && !washed) return;

    const backs = new Map<THREE.Mesh, THREE.Material>();
    for (const mesh of meshes) {
      backs.set(mesh, mesh.material as THREE.Material);
      // The back is shared by every card, so this one gets its own copy.
      const copy = (mesh.material as THREE.MeshBasicMaterial).clone();
      copy.map = washed;
      mesh.material = copy;
    }
    card.face?.color.set(BLUE_SIGHT.tint);
    tinted.set(card, { backs });
    return;
  }

  for (const [mesh, original] of was!.backs) {
    (mesh.material as THREE.Material).dispose();
    mesh.material = original;
  }
  card.face?.color.set("#ffffff");
  tinted.delete(card);
}

export interface BlueSightTable {
  localUsername: string;
  seatOf(username: string): SeatId | null;
  // A seat's fan: how many of its cards show, and the one at this place.
  visibleCount(seat: SeatId): number;
  cardObject(seat: SeatId, index: number): CardObject | null;
  // Your own blind card, while you hold it.
  localBlindCard(): CardObject | null;
}

// Brings every fan, and your blind card, in line with the counts. Call every
// frame: cards come and go with the deal and the plays.
export function applyBlueSight(state: PublicWizardGameState | null, table: BlueSightTable): void {
  for (const player of state?.players ?? []) {
    const blue = player.blueCards ?? 0;

    if (player.username === table.localUsername) {
      const own = table.localBlindCard();
      if (own) setBlueTint(own, blue > 0);
      continue;
    }

    const seat = table.seatOf(player.username);
    if (seat === null) continue;
    const showing = table.visibleCount(seat);
    // The last cards of the fan carry the blue.
    for (let index = 0; index < showing; index++) {
      const card = table.cardObject(seat, index);
      if (card) setBlueTint(card, index >= showing - blue);
    }
  }
}
