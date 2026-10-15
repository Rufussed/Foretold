import * as THREE from "three";

// The corner self portrait's cut at the waist, done in the drawing rather
// than by the page, so it can spare the arms: the body is cut along the lower
// half of the background circle, while shoulders, arms and hands reaching
// forward or down in an emote carry on over its edge. Above the circle's
// middle nothing is cut, so raised arms go up past its top as before.
//
// Each vertex is marked with how much the arm bones move it (its skin
// weights), and the portrait gets its own copies of the materials, which do
// the cut, so the same character at the table is untouched.

// Shoulder, upper arm, forearm, hand and fingers. The shoulder (clavicle)
// moves the top of the torso too, but that only matters below the circle's
// middle, where the cut is.
const ARM_BONE = /(Left|Right)(Shoulder|Arm|ForeArm|Hand)/;
const ATTRIBUTE = "portraitArm";

export interface PortraitArmCrop {
  // The circle, in the canvas's drawing-buffer pixels from its bottom left.
  setCircle(centreX: number, centreY: number, radius: number): void;
  dispose(): void;
}

// How much of each vertex follows the arm bones, 0 .. 1.
const markArms = (mesh: THREE.SkinnedMesh) => {
  const geometry = mesh.geometry;
  if (geometry.getAttribute(ATTRIBUTE)) return; // shared, already marked
  const indices = geometry.getAttribute("skinIndex");
  const weights = geometry.getAttribute("skinWeight");
  const arm = mesh.skeleton.bones.map((bone) => ARM_BONE.test(bone.name));
  const values = new Float32Array(indices.count);
  for (let vertex = 0; vertex < indices.count; vertex++) {
    let sum = 0;
    for (let k = 0; k < 4; k++) {
      if (arm[indices.getComponent(vertex, k)]) sum += weights.getComponent(vertex, k);
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
          `#include <common>\nattribute float ${ATTRIBUTE};\nvarying float vPortraitArm;`,
        )
        .replace("#include <begin_vertex>", `#include <begin_vertex>\nvPortraitArm = ${ATTRIBUTE};`);
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          "#include <common>\nuniform vec3 portraitCircle;\nvarying float vPortraitArm;",
        )
        .replace(
          "#include <dithering_fragment>",
          `#include <dithering_fragment>
          {
            // Below the circle's middle, outside it: cut, softly over a
            // couple of pixels, unless this is arm.
            vec2 fromCentre = gl_FragCoord.xy - portraitCircle.xy;
            if (fromCentre.y < 0.0) {
              float inside = 1.0 - smoothstep(portraitCircle.z - 1.0, portraitCircle.z + 1.0, length(fromCentre));
              float keep = max(inside, smoothstep(0.35, 0.65, vPortraitArm));
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
    markArms(mesh);
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
