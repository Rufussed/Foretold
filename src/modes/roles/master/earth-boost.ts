import type * as THREE from "three";
import type { Card } from "../../../../backend/src/game/wizard/models/card";
import type { PublicWizardGameState } from "../../../../backend/src/game/wizard/models/wizardGame";
import { trickRolesIn } from "../../../../backend/src/game/wizard/modes/roles/master/trickRoles";
import { boostedCardArtTexture } from "../../../visualizer/card-texture-loader";
import { cardKey, cardTexture } from "../../../visualizer/card-textures";

// Roles mode only. Cards that count higher against cards of their suit show
// it: "+3" printed under the number, in the card's colour. The Power of
// Earth's earth cards (backend master/greenWizard.ts), and a Shepherd's own 5,
// +1 for each of their sheep out (backend shepherd.ts sheepBoost); both
// together add up. In your own hand, and on the table for everyone, as the
// rules count it (backend master/trickRoles.ts boostOf): a card a Thief takes
// loses it.

export interface EarthBoostTable {
  localUsername: string;
  // The table's object for a card, in your hand or the trick.
  cardObject(key: string): THREE.Object3D | null;
}

const FACE_MATERIAL_NAME = "Card Front";

// The cards showing a boost now, and how much, so they change or go back
// once it does.
const boosted = new Map<string, { card: Card; boost: number }>();

function faceOf(object: THREE.Object3D): THREE.MeshBasicMaterial | null {
  let face: THREE.MeshBasicMaterial | null = null;
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh && !Array.isArray(mesh.material) && mesh.material.name === FACE_MATERIAL_NAME) {
      face = mesh.material as THREE.MeshBasicMaterial;
    }
  });
  return face;
}

function show(table: EarthBoostTable, card: Card, boost: number): void {
  const object = table.cardObject(cardKey(card));
  const face = object && faceOf(object);
  if (!face) return;
  const map = boost > 0 ? boostedCardArtTexture(card, boost) : cardTexture(card);
  if (face.map !== map) {
    face.map = map;
    face.needsUpdate = true;
  }
}

// Call every frame: hands, tricks and flocks change with every play.
export function applyEarthBoost(state: PublicWizardGameState | null, table: EarthBoostTable): void {
  const wanted = new Map<string, { card: Card; boost: number }>();
  const boostOf = state ? trickRolesIn(state)?.boostOf : undefined;
  if (state && boostOf) {
    const want = (username: string, card: Card, playedBy?: string) => {
      const boost = boostOf({ username, playedBy, card });
      if (boost > 0) wanted.set(cardKey(card), { card, boost });
    };
    const own = state.players.find((player) => player.username === table.localUsername);
    for (const card of own?.hand ?? []) want(table.localUsername, card);
    // The boost goes with the card's owner of the moment.
    for (const played of state.currentTrick.playedCards) want(played.username, played.card, played.playedBy);
  }

  for (const [key, { card }] of boosted) {
    if (!wanted.has(key)) {
      show(table, card, 0);
      boosted.delete(key);
    }
  }
  for (const [key, entry] of wanted) {
    show(table, entry.card, entry.boost);
    boosted.set(key, entry);
  }
}
