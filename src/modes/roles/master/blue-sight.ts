import * as THREE from "three";
import type { PublicWizardGameState } from "../../../../backend/src/game/wizard/models/wizardGame";
import type { CardObject } from "../../../visualizer/card-objects";
import type { SeatId } from "../../../visualizer/player-characters";

// Roles mode only. A Roles game's Blue Wizard sees how many blue cards each
// hidden hand holds (backend modes/roles/blueWizard.ts sends the counts to
// them alone). That many cards of each opponent's fan, and their own blind
// card if it is blue, are tinted blue on both sides. Which cards in a fan
// carry it means nothing: the fan is only as many face-down cards as the
// player holds. The Watcher's sight (backend master/watcher.ts) shows the
// same way, in purple: a player has one role, so only one sight at a time.

export interface SightColours {
  tint: string;
  wash: string;
  lift: string;
  liftStrength: number;
}

export const BLUE_SIGHT: SightColours = {
  // Multiplied into the card's front.
  tint: "#3f7dff",
  // The back's wash: its art takes this hue, and its darks are lifted towards
  // `lift` by `liftStrength` (0 to 1), so even the black back reads blue.
  wash: "#2f6bff",
  lift: "#1d4fd6",
  liftStrength: 0.55,
};

// The Watcher's watched Wizards and Jesters.
export const WATCHER_SIGHT: SightColours = {
  tint: "#b46cff",
  wash: "#9a4dff",
  lift: "#6a22c9",
  liftStrength: 0.55,
};

// The back's art washed in a sight's colour, made once for each from the
// shared back once its image has arrived; null until then.
const washedBacks = new Map<SightColours, THREE.Texture>();
function washedBack(base: THREE.Texture, colours: SightColours): THREE.Texture | null {
  const made = washedBacks.get(colours);
  if (made) return made;
  const image = base.image as (CanvasImageSource & { width: number; height: number }) | undefined;
  if (!image?.width) return null;
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(image, 0, 0);
  context.globalCompositeOperation = "color";
  context.fillStyle = colours.wash;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.globalCompositeOperation = "screen";
  context.globalAlpha = colours.liftStrength;
  context.fillStyle = colours.lift;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const washed = new THREE.CanvasTexture(canvas);
  washed.colorSpace = base.colorSpace;
  washed.flipY = base.flipY;
  washed.anisotropy = base.anisotropy;
  washedBacks.set(colours, washed);
  return washed;
}

// The material names on the card mesh (see card-objects.ts).
const BACK_MATERIAL_NAME = "Card Back";

interface Tinted {
  // The shared back material each back mesh had before it took a tinted copy.
  backs: Map<THREE.Mesh, THREE.Material>;
  colours: SightColours;
}

const tinted = new WeakMap<CardObject, Tinted>();

// Tints one card in a sight's colours, front and back, or puts it back as it
// was (null).
export function setSightTint(card: CardObject, colours: SightColours | null): void {
  const was = tinted.get(card);
  if ((was?.colours ?? null) === colours) return;
  if (was) untint(card, was);

  if (colours) {
    const meshes: THREE.Mesh[] = [];
    card.object.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh && !Array.isArray(mesh.material) && mesh.material.name === BACK_MATERIAL_NAME) meshes.push(mesh);
    });
    // Until the back's art has arrived there is nothing to wash: tried again
    // next frame.
    const base = (meshes[0]?.material as THREE.MeshBasicMaterial | undefined)?.map;
    const washed = base ? washedBack(base, colours) : null;
    if (meshes.length > 0 && !washed) return;

    const backs = new Map<THREE.Mesh, THREE.Material>();
    for (const mesh of meshes) {
      backs.set(mesh, mesh.material as THREE.Material);
      // The back is shared by every card, so this one gets its own copy.
      const copy = (mesh.material as THREE.MeshBasicMaterial).clone();
      copy.map = washed;
      mesh.material = copy;
    }
    card.face?.color.set(colours.tint);
    tinted.set(card, { backs, colours });
  }
}

function untint(card: CardObject, was: Tinted): void {
  for (const [mesh, original] of was.backs) {
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

// Brings every fan, and your blind card, in line with the counts: the Blue
// Wizard's blue cards or the Watcher's watched ones. Call every frame: cards
// come and go with the deal and the plays.
export function applyBlueSight(state: PublicWizardGameState | null, table: BlueSightTable): void {
  for (const player of state?.players ?? []) {
    const watched = player.watchedCards !== undefined;
    const count = (watched ? player.watchedCards : player.blueCards) ?? 0;
    const colours = watched ? WATCHER_SIGHT : BLUE_SIGHT;

    if (player.username === table.localUsername) {
      const own = table.localBlindCard();
      if (own) setSightTint(own, count > 0 ? colours : null);
      continue;
    }

    const seat = table.seatOf(player.username);
    if (seat === null) continue;
    const showing = table.visibleCount(seat);
    // The last cards of the fan carry the tint.
    for (let index = 0; index < showing; index++) {
      const card = table.cardObject(seat, index);
      if (card) setSightTint(card, index >= showing - count ? colours : null);
    }
  }
}
