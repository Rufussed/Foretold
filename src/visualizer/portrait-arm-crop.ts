import * as THREE from "three";

// The corner self portrait's cut at the waist, done in the drawing rather
// than by the page, so it can spare the arms and head: the body is cut along
// the lower half of the background circle, while the head, and shoulders,
// arms and hands reaching forward or down in an emote, carry on over its
// edge. Above the circle's middle nothing is cut, so raised arms go up past
// its top as before.
//
// Each vertex is marked with how much the spared bones move it (its skin
// weights), and the portrait gets its own copies of the materials, which do
// the cut, so the same character at the table is untouched.

// Shoulder, upper arm, forearm, hand and fingers, and the neck and head.
// The shoulder (clavicle) and neck move the top of the torso too, but that
// only matters below the circle's middle, where the cut is.
const SPARED_BONE = /(Left|Right)(Shoulder|Arm|ForeArm|Hand)|Neck|Head/;
const ATTRIBUTE = "portraitSpared";

export interface PortraitArmCrop {
  // The circle, in the canvas's drawing-buffer pixels from its bottom left.
  setCircle(centreX: number, centreY: number, radius: number): void;
  dispose(): void;
}

// How much of each vertex follows the spared bones, 0 .. 1.
const markSpared = (mesh: THREE.SkinnedMesh) => {
  const geometry = mesh.geometry;
  if (geometry.getAttribute(ATTRIBUTE)) return; // shared, already marked
  const indices = geometry.getAttribute("skinIndex");
  const weights = geometry.getAttribute("skinWeight");
  const spared = mesh.skeleton.bones.map((bone) => SPARED_BONE.test(bone.name));
  const values = new Float32Array(indices.count);
  for (let vertex = 0; vertex < indices.count; vertex++) {
    let sum = 0;
    for (let k = 0; k < 4; k++) {
      if (spared[indices.getComponent(vertex, k)]) sum += weights.getComponent(vertex, k);
    }
    values[vertex] = sum;
  }
  geometry.setAttribute(ATTRIBUTE, new THREE.BufferAttribute(values, 1));
};

export function applyPortraitArmCrop(root: THREE.Object3D): PortraitArmCrop {
  const circle = { value: new THREE.Vector3(0, 0, 0) };
  const copies: THREE.Material[] = [];

  const cutting = (original: THREE.Material) => {
    const material = original.clone();
    material.onBeforeCompile = (shader) => {
      shader.uniforms.portraitCircle = circle;
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>\nattribute float ${ATTRIBUTE};\nvarying float vPortraitSpared;`,
        )
        .replace("#include <begin_vertex>", `#include <begin_vertex>\nvPortraitSpared = ${ATTRIBUTE};`);
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          "#include <common>\nuniform vec3 portraitCircle;\nvarying float vPortraitSpared;",
        )
        .replace(
          "#include <dithering_fragment>",
          `#include <dithering_fragment>
          {
            // Below the circle's middle, outside it: cut, softly over a
            // couple of pixels, unless this is arm or head.
            vec2 fromCentre = gl_FragCoord.xy - portraitCircle.xy;
            if (fromCentre.y < 0.0) {
              float inside = 1.0 - smoothstep(portraitCircle.z - 1.0, portraitCircle.z + 1.0, length(fromCentre));
              float keep = max(inside, smoothstep(0.35, 0.65, vPortraitSpared));
              if (keep <= 0.0) discard;
              gl_FragColor *= keep; // premultiplied, so the edge fades
            }
          }`,
        );
    };
    material.customProgramCacheKey = () => "portrait-arm-crop";
    copies.push(material);
    return material;
  };

  root.traverse((child) => {
    const mesh = child as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    markSpared(mesh);
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map(cutting)
      : cutting(mesh.material);
  });

  return {
    setCircle(centreX, centreY, radius) {
      circle.value.set(centreX, centreY, radius);
    },
    dispose() {
      copies.forEach((material) => material.dispose());
    },
  };
}
