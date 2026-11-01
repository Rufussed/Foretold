import * as THREE from "three";
import type { PublicWizardGameState } from "../../../backend/src/game/wizard/models/wizardGame";
import { powerSealAt } from "../../../backend/src/game/wizard/modes/roles/powerSeal";
import type { RoleId } from "../../../backend/src/game/wizard/modes/roles/roles";
import { cardKey } from "../../visualizer/card-textures";
import { levelSealUrl } from "./seal-urls";
import coinPay from "../../assets/role-seals/coin-pay.png";
import coinGet from "../../assets/role-seals/coin-get.png";


// In a Roles game, a wax seal with the role's sign, in its player's level
// with the role (wax, wood … gold: sealLevels.ts), sits on the corner of
// every card in the trick played with its power on (the Thief's dagger, the
// Smith's anvil…), from the moment it lands until the trick is gathered. The
// seal always faces you and sits at the middle of whichever edge of the card
// is lowest on screen. Icons: game-icons.net (CC BY 3.0), by Lorc, Delapouite and Skoll.
//
// The colour Wizards have no card, so their plain seal in their colour goes
// where their power shows: the Yellow Wizard's card that turned the lead to
// yellow, the Red Wizard's card that shielded a red lead, every green card the
// Green Wizard plays, and any colour Wizard's own Wizard card once it has won
// the trick (the bonus).
//
// A coin outranks the seal, one badge per card: on the card of each player
// whose points moved in the trick, red with "−5" for paying, green with "+10"
// for being paid, their net amount, at the card's top middle. The coins are
// drawn for this game in the seals' style.

export const ROLE_SEALS = {
  // Each badge's width as a share of the card's width: the seal, and the
  // coin, which carries a number and so is a little larger.
  widthShare: 0.25,
  coinShare: 0.34,
  // How far in from the card's corner its middle sits, as a share of the
  // card's width and length: 0 is on the corner itself.
  insetShare: 0.12,
  // How long it takes to spring in, in seconds, never sped up.
  popSeconds: 0.35,
};

// The role whose seal goes on the card at this place in the trick, if any
// (the backend's powerSeal.ts, which also counts it for the Profile).
function sealAt(state: PublicWizardGameState, index: number): RoleId | null {
  const roleOf = (username: string) =>
    state.players.find((player) => player.username === username)?.role ?? undefined;
  return powerSealAt(state.currentTrick.playedCards, index, state.trumpSuit, roleOf, state.currentTrick.winnerUsername);
}

// A card's badge: one at a time, the most telling one.
// A seal shows its player's level with the role (wax to gold).
type Badge = { kind: "coin"; points: number } | { kind: "seal"; role: RoleId; url: string | undefined };

// How each player's points moved in this trick, by role powers: what they got
// less what they paid. Points a power moves from one player (on) to another
// (by); a Merchant's, Priest's or Warrior's settling, trade by trade.
function pointsMoved(state: PublicWizardGameState): Map<string, number> {
  const net = new Map<string, number>();
  const add = (username: string, points: number) => net.set(username, (net.get(username) ?? 0) + points);
  for (const action of state.currentTrick.roleActions ?? []) {
    // Undone by the King's peace: paid back already.
    if (action.undone) continue;
    if (action.trades) {
      for (const trade of action.trades) {
        add(action.by, trade.points);
        add(trade.player, -trade.points);
      }
    } else if (action.points && action.by !== action.on) {
      add(action.by, action.points);
      add(action.on, -action.points);
    } else if (action.points) {
      // Points from no one: a Gambler's won bet.
      add(action.by, action.points);
    }
  }
  return net;
}

// Every card's badge in the trick, by card key.
function badgesFor(state: PublicWizardGameState): Map<string, Badge> {
  const badges = new Map<string, Badge>();
  const playedCards = state.currentTrick.playedCards;

  playedCards.forEach((played, index) => {
    const role = sealAt(state, index);
    const player = state.players.find((entry) => entry.username === (played.playedBy ?? played.username));
    if (role) badges.set(cardKey(played.card), { kind: "seal", role, url: levelSealUrl(role, player?.sealLevel) });
  });

  for (const [username, points] of pointsMoved(state)) {
    const played = playedCards.find((entry) => (entry.playedBy ?? entry.username) === username);
    if (played && points) badges.set(cardKey(played.card), { kind: "coin", points });
  }

  return badges;
}

const signatureOf = (badge: Badge): string =>
  badge.kind === "coin" ? `coin:${badge.points}` : `seal:${badge.role}:${badge.url}`;

export interface RoleSeals {
  // Call every frame with the table's game state and the trick cards it shows.
  update(state: PublicWizardGameState | null, trickCards: Array<{ key: string; object: THREE.Object3D }>): void;
  dispose(): void;
}

export interface RoleSealOptions {
  parent: THREE.Object3D;
  camera: THREE.Camera;
  // The card face's size in card-mesh units (card-objects.ts).
  cardWidth: number;
  cardLength: number;
}

interface Shown {
  // The badge's layers: a seal is one, a coin its coin and number. Each
  // always faces you.
  layers: THREE.Sprite[];
  share: number;
  // A coin sits at the card's top middle, the others at its bottom middle.
  top: boolean;
  signature: string;
  shownAt: number;
}

// Springs in from nothing, overshooting a little.
const pop = (t: number) => (t >= 1 ? 1 : 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2);

// The amount on a coin, gold with a dark outline, on a clear square.
function drawAmount(text: string): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d")!;
  context.font = `700 ${text.length > 3 ? 78 : 96}px "Cinzel Variable", Cinzel, Georgia, serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineJoin = "round";
  context.lineWidth = 16;
  context.strokeStyle = "rgba(30, 10, 4, 0.95)";
  context.strokeText(text, size / 2, size / 2 + 4);
  context.fillStyle = "#ffecaa";
  context.fillText(text, size / 2, size / 2 + 4);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createRoleSeals(options: RoleSealOptions): RoleSeals {
  const loader = new THREE.TextureLoader();
  const textures = new Map<string, THREE.Texture>();
  const shown = new Map<string, Shown>();
  const world = new THREE.Vector3();
  const screen = new THREE.Vector3();
  const best = new THREE.Vector3();
  const scale = new THREE.Vector3();

  const textureFor = (url: string): THREE.Texture => {
    let texture = textures.get(url);
    if (!texture) {
      texture = loader.load(url);
      texture.colorSpace = THREE.SRGBColorSpace;
      textures.set(url, texture);
    }
    return texture;
  };

  // Drawn over the cards, so an overlapping card never hides it, and kept out
  // of the scene's tone mapping, like the cards' own art, so it shows exactly
  // as drawn rather than brightened and washed out.
  const layer = (map: THREE.Texture, order: number): THREE.Sprite => {
    const material = new THREE.SpriteMaterial({ map, transparent: true, depthTest: false, toneMapped: false });
    const sprite = new THREE.Sprite(material);
    sprite.renderOrder = order;
    options.parent.add(sprite);
    return sprite;
  };

  const build = (badge: Badge): { layers: THREE.Sprite[]; share: number } | null => {
    if (badge.kind === "seal") {
      const url = badge.url;
      return url ? { layers: [layer(textureFor(url), 12)], share: ROLE_SEALS.widthShare } : null;
    }
    const text = badge.points > 0 ? `+${badge.points}` : `\u2212${-badge.points}`;
    return {
      layers: [layer(textureFor(badge.points > 0 ? coinGet : coinPay), 12), layer(drawAmount(text), 13)],
      share: ROLE_SEALS.coinShare,
    };
  };

  const remove = (key: string) => {
    for (const sprite of shown.get(key)?.layers ?? []) {
      sprite.removeFromParent();
      // The coin's number is drawn for it alone; the images are shared.
      if (sprite.material.map instanceof THREE.CanvasTexture) sprite.material.map.dispose();
      sprite.material.dispose();
    }
    shown.delete(key);
  };

  // The middle of the card's edge that is lowest on screen (or highest, for
  // a coin), a little in from it, in the parent's own space.
  const cornerOf = (card: THREE.Object3D, top: boolean): THREE.Vector3 => {
    const across = (options.cardWidth / 2) * (1 - 2 * ROLE_SEALS.insetShare);
    const along = (options.cardLength / 2) * (1 - ROLE_SEALS.insetShare * (options.cardWidth / options.cardLength) * 2);
    let bestScore = -Infinity;
    for (const [x, z] of [[0, along], [0, -along], [across, 0], [-across, 0]] as const) {
      world.set(x, 0, z);
      card.localToWorld(world);
      screen.copy(world).project(options.camera);
      const score = top ? screen.y : -screen.y;
      if (score > bestScore) {
        bestScore = score;
        best.copy(world);
      }
    }
    return options.parent.worldToLocal(best.clone());
  };

  return {
    update(state, trickCards) {
      const now = performance.now() / 1000;
      const badges = state ? badgesFor(state) : new Map<string, Badge>();
      const parentScale = options.parent.getWorldScale(new THREE.Vector3()).x || 1;

      for (const { key, object } of trickCards) {
        const badge = badges.get(key);
        if (!badge) continue;
        const signature = signatureOf(badge);
        let entry = shown.get(key);
        // A new badge, or a different one: it springs in afresh.
        if (entry && entry.signature !== signature) {
          remove(key);
          entry = undefined;
        }
        if (!entry) {
          const built = build(badge);
          if (!built) continue;
          entry = { ...built, top: badge.kind === "coin", signature, shownAt: now };
          shown.set(key, entry);
        }
        const corner = cornerOf(object, entry.top);
        object.getWorldScale(scale);
        const size = (options.cardWidth * scale.x * entry.share) / parentScale;
        const grown = pop((now - entry.shownAt) / ROLE_SEALS.popSeconds);
        for (const sprite of entry.layers) {
          sprite.position.copy(corner);
          sprite.scale.set(size * grown, size * grown, 1);
        }
      }

      const onTable = new Set(trickCards.map((entry) => entry.key));
      for (const key of [...shown.keys()]) {
        if (!onTable.has(key) || !badges.has(key)) remove(key);
      }
    },

    dispose() {
      for (const key of [...shown.keys()]) remove(key);
      for (const texture of textures.values()) texture.dispose();
    },
  };
}
