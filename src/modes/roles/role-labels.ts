import * as THREE from "three";
import type { PublicWizardGameState } from "../../../backend/src/game/wizard/models/wizardGame";
import type { SeatId } from "../../visualizer/player-characters";
import { t } from "../../i18n";

// In a Roles game, each other player's role floats above their head as a word
// in the Roles colour, so everyone sees who is what. A sprite always faces the
// camera; it follows the head as the avatar moves, and is sized from the head,
// so it reads the same whatever the scene's scale. Your own role is in the
// player list (you are the camera, so there is no head to put it over).

export const ROLE_LABELS = {
  // Text colour (the Roles colour, as in lobby.css .mode-roles) and outline.
  color: "rgb(184, 132, 224)",
  outline: "rgba(12, 6, 20, 0.9)",
  // The label's height, and its gap above the head's middle, in head radii.
  heightRadii: 0.75,
  liftRadii: 1.9,
  // The texture's height in pixels; its width follows the word.
  textPx: 96,
};

export interface RoleLabels {
  // Call every frame with the newest game state.
  update(state: PublicWizardGameState | null): void;
  dispose(): void;
}

export interface RoleLabelOptions {
  parent: THREE.Object3D;
  localUsername: string;
  seatOf(username: string): SeatId | null;
  headOf(seat: SeatId): THREE.Vector3 | null;
  headRadiusOf(seat: SeatId): number | null;
}

interface Label {
  text: string;
  sprite: THREE.Sprite;
  aspect: number;
}

// The word on a transparent canvas, outlined so it reads against any scene.
function drawWord(text: string): { texture: THREE.CanvasTexture; aspect: number } {
  const size = ROLE_LABELS.textPx;
  const font = `600 ${size * 0.72}px "Cinzel Variable", Cinzel, serif`;
  const measure = document.createElement("canvas").getContext("2d")!;
  measure.font = font;
  const padding = size * 0.2;
  const width = Math.ceil(measure.measureText(text).width + padding * 2);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = size;
  const context = canvas.getContext("2d")!;
  context.font = font;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineJoin = "round";
  context.lineWidth = size * 0.12;
  context.strokeStyle = ROLE_LABELS.outline;
  context.strokeText(text, width / 2, size / 2);
  context.fillStyle = ROLE_LABELS.color;
  context.fillText(text, width / 2, size / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { texture, aspect: width / size };
}

export function createRoleLabels(options: RoleLabelOptions): RoleLabels {
  const labels = new Map<string, Label>();
  const head = new THREE.Vector3();
  const parentScale = new THREE.Vector3();

  const remove = (username: string) => {
    const label = labels.get(username);
    if (!label) return;
    label.sprite.removeFromParent();
    label.sprite.material.map?.dispose();
    label.sprite.material.dispose();
    labels.delete(username);
  };

  const labelFor = (username: string, text: string): Label => {
    const existing = labels.get(username);
    if (existing?.text === text) return existing;
    remove(username);
    const { texture, aspect } = drawWord(text);
    // Drawn over the scene's depth, so a raised card or another head never
    // hides it, and not lit, so it keeps its colour.
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(material);
    sprite.renderOrder = 10;
    options.parent.add(sprite);
    const label = { text, sprite, aspect };
    labels.set(username, label);
    return label;
  };

  return {
    update(state) {
      const wanted = new Set<string>();

      for (const player of state?.players ?? []) {
        if (!player.role || player.username === options.localUsername) continue;
        const seat = options.seatOf(player.username);
        const middle = seat ? options.headOf(seat) : null;
        const radius = seat ? options.headRadiusOf(seat) : null;
        if (!middle || !radius) continue;

        wanted.add(player.username);
        const label = labelFor(player.username, t(`role.${player.role}`));

        // World sizes, brought into the parent's own units.
        options.parent.getWorldScale(parentScale);
        const scale = parentScale.y || 1;
        head.copy(middle).setY(middle.y + radius * ROLE_LABELS.liftRadii);
        label.sprite.position.copy(options.parent.worldToLocal(head));
        const height = (radius * ROLE_LABELS.heightRadii) / scale;
        label.sprite.scale.set(height * label.aspect, height, 1);
      }

      for (const username of [...labels.keys()]) {
        if (!wanted.has(username)) remove(username);
      }
    },

    dispose() {
      for (const username of [...labels.keys()]) remove(username);
    },
  };
}
