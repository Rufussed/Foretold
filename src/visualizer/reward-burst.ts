import * as THREE from "three";
import { BURST } from "./config";

export type BurstColor = readonly [number, number, number];

// The colour for a trick just won, by how the winner's tricks stand against
// their prediction: a green that deepens as they near it, gold on it, red over.
// With no prediction (the demo table) it's gold.
export function burstColorFor(tricksWon: number, prediction: number | null): BurstColor {
  if (prediction === null || tricksWon === prediction) return BURST.color;
  if (tricksWon > prediction) return BURST.overColor;
  const progress = Math.min(Math.max(tricksWon / prediction, 0), 1);
  return BURST.underStartColor.map((start, channel) => start + (BURST.underColor[channel] - start) * progress) as unknown as BurstColor;
}

// The same colour as a CSS string, for tinting the tesseract to match.
export const burstCss = (color: BurstColor): string =>
  new THREE.Color().setRGB(color[0], color[1], color[2], THREE.SRGBColorSpace).getStyle();

export interface RewardBurst {
  // A burst of rays from this point, in the environment's space, in this colour.
  spawn(position: THREE.Vector3, color: BurstColor): void;
  update(deltaSeconds: number): void;
  dispose(): void;
}

const LINE_VERTEX = /* glsl */ `
  attribute float aAlpha;
  attribute vec3 aColor;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vAlpha = aAlpha;
    vColor = aColor;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const LINE_FRAGMENT = /* glsl */ `
  uniform float uBrightness;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    gl_FragColor = vec4(vColor * uBrightness, vAlpha);
  }
`;

const TIP_VERTEX = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  uniform float uPixelsPerUnit;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPixelsPerUnit / max(-mv.z, 0.001);
    vAlpha = aAlpha;
  }
`;

const TIP_FRAGMENT = /* glsl */ `
  uniform float uBrightness;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    // A soft round dot, brightest in the middle.
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float falloff = smoothstep(1.0, 0.0, d);
    gl_FragColor = vec4(vColor * uBrightness, falloff * vAlpha);
  }
`;

const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

// A small spray of golden rays, flying out in every direction from a point as
// the tesseract dives away. Each is a streak with a glowing tip, fading as it
// slows. See BURST.
export function createRewardBurst(environment: THREE.Object3D): RewardBurst {
  const max = BURST.maxRays;
  const origin = new Float32Array(max * 3);
  const direction = new Float32Array(max * 3);
  const reach = new Float32Array(max);
  const age = new Float32Array(max);
  const life = new Float32Array(max);
  const alive = new Uint8Array(max);
  const color = new Float32Array(max * 3);

  // Each ray is a line from tail to head, and a dot at the head.
  const linePositions = new Float32Array(max * 2 * 3);
  const lineAlpha = new Float32Array(max * 2);
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute("position", new THREE.BufferAttribute(linePositions, 3).setUsage(THREE.DynamicDrawUsage));
  lineGeometry.setAttribute("aAlpha", new THREE.BufferAttribute(lineAlpha, 1).setUsage(THREE.DynamicDrawUsage));
  // A ray's colour is set once, when it's made: both ends of its line, and its tip.
  const lineColor = new Float32Array(max * 2 * 3);
  lineGeometry.setAttribute("aColor", new THREE.BufferAttribute(lineColor, 3).setUsage(THREE.DynamicDrawUsage));

  const tipPositions = new Float32Array(max * 3);
  const tipSizes = new Float32Array(max);
  const tipAlpha = new Float32Array(max);
  const tipGeometry = new THREE.BufferGeometry();
  tipGeometry.setAttribute("position", new THREE.BufferAttribute(tipPositions, 3).setUsage(THREE.DynamicDrawUsage));
  tipGeometry.setAttribute("aSize", new THREE.BufferAttribute(tipSizes, 1).setUsage(THREE.DynamicDrawUsage));
  tipGeometry.setAttribute("aAlpha", new THREE.BufferAttribute(tipAlpha, 1).setUsage(THREE.DynamicDrawUsage));
  tipGeometry.setAttribute("aColor", new THREE.BufferAttribute(color, 3).setUsage(THREE.DynamicDrawUsage));

  const uniforms = {
    uBrightness: { value: BURST.brightness },
  };
  const lineMaterial = new THREE.ShaderMaterial({
    vertexShader: LINE_VERTEX,
    fragmentShader: LINE_FRAGMENT,
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const tipMaterial = new THREE.ShaderMaterial({
    vertexShader: TIP_VERTEX,
    fragmentShader: TIP_FRAGMENT,
    uniforms: { ...uniforms, uPixelsPerUnit: { value: 500 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
  const tips = new THREE.Points(tipGeometry, tipMaterial);
  for (const object of [lines, tips]) {
    object.frustumCulled = false;
    object.renderOrder = 11;
    environment.add(object);
  }
  lines.name = "reward-burst-rays";
  tips.name = "reward-burst-tips";
  const buffer = new THREE.Vector2();
  tips.onBeforeRender = (renderer, _scene, camera) => {
    renderer.getDrawingBufferSize(buffer);
    const fov = (camera as THREE.PerspectiveCamera).fov ?? 45;
    tipMaterial.uniforms.uPixelsPerUnit.value = buffer.y / (2 * Math.tan(THREE.MathUtils.degToRad(fov) / 2));
  };

  let next = 0;
  const spawnRay = (position: THREE.Vector3, rgb: readonly number[]) => {
    for (let tries = 0; tries < max; tries++) {
      const i = (next + tries) % max;
      if (alive[i]) continue;
      next = (i + 1) % max;
      alive[i] = 1;
      // A random direction on the sphere.
      const z = Math.random() * 2 - 1;
      const angle = Math.random() * Math.PI * 2;
      const flat = Math.sqrt(1 - z * z);
      direction[i * 3] = flat * Math.cos(angle);
      direction[i * 3 + 1] = z;
      direction[i * 3 + 2] = flat * Math.sin(angle);
      origin[i * 3] = position.x;
      origin[i * 3 + 1] = position.y;
      origin[i * 3 + 2] = position.z;
      reach[i] = BURST.radius * (1 - Math.random() * BURST.radiusRandomness);
      life[i] = BURST.lifeSeconds * (1 + (Math.random() * 2 - 1) * BURST.lifeRandomness);
      age[i] = 0;
      for (let channel = 0; channel < 3; channel++) {
        color[i * 3 + channel] = rgb[channel];
        lineColor[i * 6 + channel] = rgb[channel];
        lineColor[i * 6 + 3 + channel] = rgb[channel];
      }
      return;
    }
  };

  return {
    spawn(position, rgb) {
      if (!BURST.enabled) return;
      for (let n = 0; n < BURST.rays; n++) spawnRay(position, rgb);
      lineGeometry.attributes.aColor.needsUpdate = true;
      tipGeometry.attributes.aColor.needsUpdate = true;
    },

    update(deltaSeconds) {
      const dt = Math.min(deltaSeconds, 0.1);
      let any = false;
      for (let i = 0; i < max; i++) {
        if (!alive[i]) {
          tipAlpha[i] = 0;
          lineAlpha[i * 2] = 0;
          lineAlpha[i * 2 + 1] = 0;
          continue;
        }
        age[i] += dt;
        const t = age[i] / life[i];
        if (t >= 1) {
          alive[i] = 0;
          tipAlpha[i] = 0;
          lineAlpha[i * 2] = 0;
          lineAlpha[i * 2 + 1] = 0;
          continue;
        }
        any = true;
        const flown = reach[i] * easeOut(t);
        const tail = Math.max(0, flown * (1 - BURST.lengthFraction));
        const fade = 1 - t;
        for (let axis = 0; axis < 3; axis++) {
          const base = origin[i * 3 + axis];
          const along = direction[i * 3 + axis];
          linePositions[i * 6 + axis] = base + along * tail;
          linePositions[i * 6 + 3 + axis] = base + along * flown;
          tipPositions[i * 3 + axis] = base + along * flown;
        }
        lineAlpha[i * 2] = 0; // the tail fades to nothing
        lineAlpha[i * 2 + 1] = fade;
        tipAlpha[i] = fade;
        tipSizes[i] = BURST.tipSize * (1 - t * 0.5);
      }
      lines.visible = tips.visible = any;
      lineGeometry.attributes.position.needsUpdate = true;
      lineGeometry.attributes.aAlpha.needsUpdate = true;
      tipGeometry.attributes.position.needsUpdate = true;
      tipGeometry.attributes.aSize.needsUpdate = true;
      tipGeometry.attributes.aAlpha.needsUpdate = true;
    },

    dispose() {
      lines.removeFromParent();
      tips.removeFromParent();
      lineGeometry.dispose();
      tipGeometry.dispose();
      lineMaterial.dispose();
      tipMaterial.dispose();
    },
  };
}
