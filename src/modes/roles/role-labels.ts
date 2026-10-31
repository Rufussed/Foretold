import * as THREE from "three";
import type { PublicWizardGameState } from "../../../backend/src/game/wizard/models/wizardGame";
import type { SeatId } from "../../visualizer/player-characters";
import { t } from "../../i18n";
import { roleUses } from "../../visualizer/hud/announcements";

// In a Roles game, each other player's role floats above their head as a word
// in the Roles colour, so everyone sees who is what. A sprite always faces the
// camera; it follows the head as the avatar moves, and is sized from the head,
// so it reads the same whatever the scene's scale. Your own role is in the
// player list (you are the camera, so there is no head to put it over).
//
// When a player's power goes off, their label turns gold (red when it hit
// you) and stays so until the trick is cleared; it swells for a moment as it
// lights. onUse and onClear tell the player list, where your own role is.

export const ROLE_LABELS = {
  // Text colour (the Roles colour, as in lobby.css .mode-roles) and outline.
  color: "rgb(184, 132, 224)",
  // A power used in this trick: the colour the label keeps until the trick is
  // cleared (red when it hit you); how much bigger it swells as it lights and
  // how long that takes to settle; and how long the colour takes to fade
  // back once the trick is gone. Seconds, never sped up.
  flashColor: "rgb(255, 214, 90)",
  hitColor: "rgb(255, 80, 70)",
  flashGrow: 1.35,
  growSeconds: 1,
  fadeSeconds: 0.6,
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
  // A player's power just went off, as the table shows it...
  onUse?(username: string, hitYou: boolean): void;
  // ...and the trick it went off in is cleared.
  onClear?(username: string): void;
}

interface Label {
  text: string;
  sprite: THREE.Sprite;
  aspect: number;
}

interface Flash {
  at: number;
  color: THREE.Color;
  // When its trick was cleared, from which the colour fades.
  endedAt?: number;
}

// The trick on the table, while its first card stays the same.
const trickKey = (state: PublicWizardGameState | null): string | null => {
  const first = state?.currentTrick.playedCards[0]?.card;
  return state && first ? `${state.currentRound}:${first.suit}:${first.value}` : null;
};

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
  // White, tinted by the material: the Roles colour, or a flash.
  context.fillStyle = "#fff";
  context.fillText(text, width / 2, size / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { texture, aspect: width / size };
}

export function createRoleLabels(options: RoleLabelOptions): RoleLabels {
  const labels = new Map<string, Label>();
  const flashes = new Map<string, Flash>();
  const base = new THREE.Color(ROLE_LABELS.color);
  const flashColor = new THREE.Color(ROLE_LABELS.flashColor);
  const hitColor = new THREE.Color(ROLE_LABELS.hitColor);
  let previous: PublicWizardGameState | null = null;
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
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, color: base });
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
      const now = performance.now() / 1000;

      if (state && previous && state !== previous) {
        // The trick is gone: every lit label starts to fade.
        if (trickKey(state) !== trickKey(previous)) {
          for (const [username, flash] of flashes) {
            if (flash.endedAt !== undefined) continue;
            flash.endedAt = now;
            options.onClear?.(username);
          }
        }
        for (const { by, hitYou } of roleUses(previous, state, options.localUsername)) {
          // A second power in the same trick keeps the swell, red winning.
          const lit = flashes.get(by);
          const keep = lit?.endedAt === undefined ? lit : undefined;
          const hit = hitYou || keep?.color === hitColor;
          flashes.set(by, { at: keep ? keep.at : now, color: hit ? hitColor : flashColor });
          options.onUse?.(by, hit);
        }
      }
      previous = state;

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
        // Lit for the whole trick, then fading back; the swell settles first.
        const flash = flashes.get(player.username);
        const ease = (x: number) => (x > 0 ? Math.min(x, 1) ** 2 * (3 - 2 * Math.min(x, 1)) : 0);
        const lit = !flash ? 0 : flash.endedAt === undefined ? 1 : ease(1 - (now - flash.endedAt) / ROLE_LABELS.fadeSeconds);
        if (flash && lit <= 0) flashes.delete(player.username);
        const swell = flash ? ease(1 - (now - flash.at) / ROLE_LABELS.growSeconds) * lit : 0;
        label.sprite.material.color.copy(base);
        if (flash && lit > 0) label.sprite.material.color.lerp(flash.color, lit);
        const height = ((radius * ROLE_LABELS.heightRadii) / scale) * (1 + (ROLE_LABELS.flashGrow - 1) * swell);
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
