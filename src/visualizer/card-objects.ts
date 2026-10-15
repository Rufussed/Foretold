import * as THREE from "three";
import { cardBackTexture } from "./card-textures";
import { CARD_HANDLING, CARDS } from "./config";

export interface CardObject {
  object: THREE.Object3D;
  face: THREE.MeshBasicMaterial | null;
  outline: THREE.Mesh;
}

// How one card's outline differs from the shared hover outline every other
// card uses. Only the turned-up trump needs either of these.
export interface CardOutlineOptions {
  // Multiplies CARD_HANDLING.outlineWidth for this card alone.
  widthMultiplier?: number;
  // Its own material rather than the one shared by every card, so this
  // outline's colour can be set without changing all the others.
  ownMaterial?: boolean;
}

// How the screen pass (sharpen-pass.ts) treats a card's pixels.
export interface CardSmoothingOptions {
  // Left out of its edge smoothing: the cards players read, so their art
  // stays as scanned.
  unsmoothed?: boolean;
  // Its paper edge blurred instead of sharpened: the stack, whose side is
  // sixty card edges each thinner than a pixel, which otherwise break up into
  // flickering stripes. The edge has no art to lose; the back stays crisp.
  soft?: boolean;
}

// What a card's pixels tell the screen pass, in the alpha nothing else uses
// (opaque materials otherwise write exactly 1). sharpen-pass.ts reads these.
type PixelMark = "none" | "unsmoothed" | "soft";
const MARK_ALPHA: Record<Exclude<PixelMark, "none">, string> = {
  unsmoothed: "0.5",
  soft: "0.25",
};

// Writes the mark after the material's own output.
const markPixels = (fragmentShader: string, mark: PixelMark) =>
  mark === "none"
    ? fragmentShader
    : fragmentShader.replace(
        "#include <opaque_fragment>",
        `#include <opaque_fragment>
         gl_FragColor.a = ${MARK_ALPHA[mark]};`,
      );

export interface CardFactory {
  readonly width: number; // card face width, in card-mesh units
  readonly length: number; // card face length, in card-mesh units
  // A new card, added to the environment and hidden until something places it.
  build(
    name: string,
    texture: THREE.Texture,
    outline?: CardOutlineOptions,
    smoothing?: CardSmoothingOptions,
  ): CardObject;
}

const TEMPLATE_NODE = "card01";
const FACE_MATERIAL_NAME = "Card Front";
const BACK_MATERIAL_NAME = "Card Back";
const EDGE_MATERIAL_NAME = "Card Paper Edge";
// Sits just behind the card's back face, so only its rim shows past the edges.
const OUTLINE_DEPTH = 0.004;

// The card art shows as scanned, not as the room lights it: the faces are the
// game, and the torches flicker too hard for a lit material to stay readable.
// Unlit and untone-mapped, so the pixels reach the screen as they are. The
// mesh still casts a shadow, which comes from its depth, not its material.
function unlitCardMaterial(
  map: THREE.Texture,
  name: string,
  mark: PixelMark = "none",
): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({ map, toneMapped: false });
  material.name = name;
  // The variants differ only in what onBeforeCompile writes, so three needs
  // telling them apart or it would share one compiled program.
  material.customProgramCacheKey = () => `card-${mark}`;
  material.onBeforeCompile = (shader) => {
    // Sample the art's mipmaps a little sharper than the GPU would choose.
    shader.fragmentShader = markPixels(
      shader.fragmentShader.replace(
        "#include <map_fragment>",
        THREE.ShaderChunk.map_fragment.replace(
          "texture2D( map, vMapUv )",
          `texture2D( map, vMapUv, ${CARDS.mipBias.toFixed(2)} )`,
        ),
      ),
      mark,
    );
  };
  return material;
}

// The card's own material (its paper edge), marked for the screen pass.
const markedCopy = (original: THREE.Material, mark: PixelMark): THREE.Material => {
  const material = original.clone();
  material.customProgramCacheKey = () => `card-edge-${mark}`;
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = markPixels(shader.fragmentShader, mark);
  };
  return material;
};

// Makes card objects from the card mesh in Wizard.glb (the one under card01),
// each with its own face material and a hidden hover outline behind it. Every
// card on the table comes from here, so they all look alike.
export function createCardFactory(environment: THREE.Object3D): CardFactory {
  const template = environment.getObjectByName(TEMPLATE_NODE)?.children[0];
  if (!template) throw new Error(`No ${TEMPLATE_NODE} card mesh in the scene to build cards from`);

  let templateFront: THREE.Mesh | null = null;
  template.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh && !Array.isArray(mesh.material) && mesh.material.name === FACE_MATERIAL_NAME) {
      templateFront = mesh;
    }
  });
  const front = templateFront as THREE.Mesh | null;
  if (!front) throw new Error(`Card mesh has no "${FACE_MATERIAL_NAME}" material`);

  // Every card shows the same back, so it is set once here on the shared
  // material rather than per card: clones keep the template's materials by
  // reference, and only the face is cloned to carry its own art.
  template.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || Array.isArray(mesh.material)) return;
    if (mesh.material.name !== BACK_MATERIAL_NAME) return;
    mesh.material = unlitCardMaterial(cardBackTexture(), mesh.material.name);
  });
  // Soft cards' copy of the shared paper edge, made when first needed and
  // shared among them.
  const softCopies = new Map<THREE.Material, THREE.Material>();
  const softCopy = (material: THREE.Material) => {
    let copy = softCopies.get(material);
    if (!copy) {
      copy = markedCopy(material, "soft");
      softCopies.set(material, copy);
    }
    return copy;
  };

  front.geometry.computeBoundingBox();
  const size = front.geometry.boundingBox!.getSize(new THREE.Vector3());

  const outlineMaterial = new THREE.MeshBasicMaterial({
    color: CARD_HANDLING.outlineColor,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const outlineGrow = 2 * CARD_HANDLING.outlineWidth * size.x;

  return {
    width: size.x,
    length: size.z,

    build(name, texture, outlineOptions, smoothing) {
      const object = template.clone(true);
      object.name = name;
      object.visible = false;

      let faceMesh: THREE.Mesh | null = null;
      let faceMaterial: THREE.MeshBasicMaterial | null = null;
      const mark: PixelMark = smoothing?.soft ? "soft" : smoothing?.unsmoothed ? "unsmoothed" : "none";
      object.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh || Array.isArray(mesh.material)) return;
        // A soft card is a stack card: it still casts the stack's shadow onto
        // the table, but takes none, since each card's edge in the stack would
        // be shadowed by the one a hair above it, in stripes.
        if (mark === "soft") mesh.receiveShadow = false;
        if (mesh.material.name !== FACE_MATERIAL_NAME) {
          // Only the paper edge is softened; the back keeps its art crisp.
          if (mark === "soft" && mesh.material.name === EDGE_MATERIAL_NAME) {
            mesh.material = softCopy(mesh.material);
          }
          return;
        }
        // A soft card's face is treated like any other: the softening is for
        // its edge alone.
        const material = unlitCardMaterial(texture, mesh.material.name, mark === "soft" ? "none" : mark);
        mesh.material = material;
        faceMesh = mesh;
        faceMaterial = material;
      });
      const faceOf = faceMesh as THREE.Mesh | null;

      const grow = outlineGrow * (outlineOptions?.widthMultiplier ?? 1);
      const outline = new THREE.Mesh(
        front.geometry,
        outlineOptions?.ownMaterial ? outlineMaterial.clone() : outlineMaterial,
      );
      outline.name = "card-outline";
      outline.visible = false;
      outline.castShadow = false;
      outline.raycast = () => {};
      outline.scale.set(1 + grow / size.x, 1, 1 + grow / size.z);
      outline.position.set(0, -OUTLINE_DEPTH, 0);
      (faceOf?.parent ?? object).add(outline);

      environment.add(object);
      return { object, outline, face: faceMaterial as THREE.MeshBasicMaterial | null };
    },
  };
}
