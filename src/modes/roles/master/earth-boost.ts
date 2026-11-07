import type * as THREE from "three";
import type { Card } from "../../../../backend/src/game/wizard/models/card";
import type { PublicWizardGameState } from "../../../../backend/src/game/wizard/models/wizardGame";
import { GREEN_BOOST, isGreenCard } from "../../../../backend/src/game/wizard/modes/roles/master/greenWizard";
import { masterRoleOf } from "../../../../backend/src/game/wizard/modes/roles/roles";
import { boostedCardArtTexture } from "../../../visualizer/card-texture-loader";
import { cardKey, cardTexture } from "../../../visualizer/card-textures";

// Roles mode only. The Power of Earth's earth cards count 3 higher against
// other earth cards (backend master/greenWizard.ts), so they show it: "+3"
// printed under the number, in the earth colour. In your own hand when you
// hold the power, and on the table for everyone, on every earth card its
// owner of the moment holds the power for (a card a Thief takes loses it).

export interface EarthBoostTable {
  localUsername: string;
  // The table's object for a card, in your hand or the trick.
  cardObject(key: string): THREE.Object3D | null;
}

const FACE_MATERIAL_NAME = "Card Front";

// The cards showing the boost now, so they go back once it is gone.
const boosted = new Map<string, Card>();

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

function show(table: EarthBoostTable, card: Card, on: boolean): void {
  const object = table.cardObject(cardKey(card));
  const face = object && faceOf(object);
  if (!face) return;
  const map = on ? boostedCardArtTexture(card, GREEN_BOOST) : cardTexture(card);
  if (face.map !== map) {
    face.map = map;
    face.needsUpdate = true;
  }
}

// Call every frame: hands and tricks change with every play.
export function applyEarthBoost(state: PublicWizardGameState | null, table: EarthBoostTable): void {
  const wanted = new Map<string, Card>();
  if (state?.options?.mode === "roles") {
    const hasEarth = (username: string) => {
      const player = state.players.find((entry) => entry.username === username);
      return !!player && masterRoleOf(player) === "greenWizard";
    };
    const own = state.players.find((player) => player.username === table.localUsername);
    if (own && hasEarth(own.username)) {
      for (const card of own.hand) if (isGreenCard(card)) wanted.set(cardKey(card), card);
    }
    // The boost goes with the card's owner of the moment.
    for (const played of state.currentTrick.playedCards) {
      if (isGreenCard(played.card) && hasEarth(played.username)) wanted.set(cardKey(played.card), played.card);
    }
  }

  for (const [key, card] of boosted) {
    if (!wanted.has(key)) {
      show(table, card, false);
      boosted.delete(key);
    }
  }
  for (const [key, card] of wanted) {
    show(table, card, true);
    boosted.set(key, card);
  }
}
