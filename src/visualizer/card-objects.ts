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

// Which cards the screen pass leaves out of its edge smoothing (see
// sharpen-pass.ts): the ones players read, so their art stays as scanned.
export interface CardSmoothingOptions {
  unsmoothed?: boolean;
}

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
// Sits just behind the card's back face, so only its rim shows past the edges.
const OUTLINE_DEPTH = 0.004;

// The card art shows as scanned, not as the room lights it: the faces are the
// game, and the torches flicker too hard for a lit material to stay readable.
// Unlit and untone-mapped, so the pixels reach the screen as they are. The
// mesh still casts a shadow, which comes from its depth, not its material.
function unlitCardMaterial(
  map: THREE.Texture,
  name: string,
  unsmoothed = false,
): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({ map, toneMapped: false });
  material.name = name;
  // The two variants differ only in what onBeforeCompile writes, so three
  // needs telling them apart or it would share one compiled program.
  material.customProgramCacheKey = () => (unsmoothed ? "card-unsmoothed" : "card-smoothed");
  material.onBeforeCompile = (shader) => {
    // Sample the art's mipmaps a little sharper than the GPU would choose.
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <map_fragment>",
        THREE.ShaderChunk.map_fragment.replace(
          "texture2D( map, vMapUv )",
          `texture2D( map, vMapUv, ${CARDS.mipBias.toFixed(2)} )`,
        ),
      )
      // Mark the pixel, in the alpha nothing else uses, so the screen pass
      // can leave it out of its edge smoothing (see sharpen-pass.ts). Opaque
      // materials otherwise write exactly 1.
      .replace(
        "#include <opaque_fragment>",
        unsmoothed
          ? `#include <opaque_fragment>
             gl_FragColor.a = 0.5;`
          : "#include <opaque_fragment>",
      );
  };
  return material;
}

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
      object.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh || Array.isArray(mesh.material)) return;
        if (mesh.material.name !== FACE_MATERIAL_NAME) return;
        const material = unlitCardMaterial(texture, mesh.material.name, smoothing?.unsmoothed);
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
