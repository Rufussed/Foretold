import * as THREE from "three";

// The outline of the trick's leading card: the gold ring of the gameplay
// announcements, with a bright glint running round it. It is the same
// conic gradient the announcer's border uses (hud-gold-border, in style.css),
// worked out per pixel from where it sits round the card, and turning once
// every PERIOD seconds.

const PERIOD_SECONDS = 4;

const VERTEX = /* glsl */ `
  varying vec2 vLocal;
  uniform vec2 centre;
  void main() {
    vLocal = position.xz - centre;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// The announcer's stops: dark 0%, mid 15%, glint 25%, mid 35%, dark 50%,
// mid 75%, dark 100%.
const FRAGMENT = /* glsl */ `
  varying vec2 vLocal;
  uniform float time;
  uniform vec3 dark;
  uniform vec3 mid;
  uniform vec3 glint;

  vec3 ring(float t) {
    if (t < 0.15) return mix(dark, mid, t / 0.15);
    if (t < 0.25) return mix(mid, glint, (t - 0.15) / 0.10);
    if (t < 0.35) return mix(glint, mid, (t - 0.25) / 0.10);
    if (t < 0.50) return mix(mid, dark, (t - 0.35) / 0.15);
    if (t < 0.75) return mix(dark, mid, (t - 0.50) / 0.25);
    return mix(mid, dark, (t - 0.75) / 0.25);
  }

  void main() {
    float turn = atan(vLocal.y, vLocal.x) / 6.2831853;
    gl_FragColor = vec4(ring(fract(turn + time / ${PERIOD_SECONDS.toFixed(1)})), 1.0);
    #include <colorspace_fragment>
  }
`;

// `geometry` is the card face the outline is a scaled copy of; its middle is
// where the ring turns about.
export function createLeadingOutlineMaterial(geometry: THREE.BufferGeometry): THREE.ShaderMaterial {
  geometry.computeBoundingBox();
  const middle = geometry.boundingBox!.getCenter(new THREE.Vector3());
  return new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    side: THREE.DoubleSide,
    toneMapped: false,
    uniforms: {
      time: { value: 0 },
      centre: { value: new THREE.Vector2(middle.x, middle.z) },
      dark: { value: new THREE.Color("#8a5d12") },
      mid: { value: new THREE.Color("#ffd54f") },
      glint: { value: new THREE.Color("#fff3b0") },
    },
  });
}

// Set once a frame by whatever draws the outline.
export const setLeadingOutlineTime = (material: THREE.ShaderMaterial, seconds: number): void => {
  material.uniforms.time.value = seconds;
};
