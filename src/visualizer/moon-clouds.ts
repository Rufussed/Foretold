import * as THREE from "three";
import { CLOUDS } from "./config";

export interface MoonClouds {
  update(deltaSeconds: number): void;
  dispose(): void;
}

const between = (min: number, max: number) => min + Math.random() * (max - min);
// Bunched towards zero, so a cloud's puffs gather in the middle.
const bell = () => (Math.random() + Math.random() + Math.random()) / 1.5 - 1;
const smooth = (x: number) => {
  const t = Math.min(Math.max(x, 0), 1);
  return t * t * (3 - 2 * t);
};

const VERTEX = /* glsl */ `
  attribute float aSize;
  attribute float aOpacity;
  uniform float uPixelsPerUnit;
  varying float vOpacity;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPixelsPerUnit / max(-mv.z, 0.001);
    vOpacity = aOpacity;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uCore;
  varying float vOpacity;
  void main() {
    // A soft round blob: solid in the middle, fading to nothing at its edge.
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float falloff = smoothstep(1.0, uCore, d);
    gl_FragColor = vec4(uColor, falloff * vOpacity);
  }
`;

interface Cloud {
  alive: boolean;
  u: number; // across the lane, left to right
  v: number; // up the lane
  width: number;
  speed: number; // lane units per second
  halfLane: number; // |u| at which it has cleared the moon
  // Where each puff sits in the cloud, how big it is, and how dark.
  puffX: Float32Array;
  puffY: Float32Array;
  puffSize: Float32Array;
  puffOpacity: Float32Array;
}

// Fuzzy black clouds drifting left to right across the moon, in front of it as
// the camera sees it. See CLOUDS. Null if the scene has no moon.
export function createMoonClouds(environment: THREE.Object3D, getCamera: () => THREE.Camera): MoonClouds | null {
  const moon = environment.getObjectByName(CLOUDS.moonObject);
  if (!moon) {
    console.warn(`[clouds] no "${CLOUDS.moonObject}" in the scene`);
    return null;
  }
  environment.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(moon);
  const moonCenter = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const moonRadius = Math.max(size.x, size.y, size.z) / 2;

  const max = CLOUDS.maxClouds;
  const per = CLOUDS.puffs;
  const clouds: Cloud[] = Array.from({ length: max }, () => ({
    alive: false,
    u: 0,
    v: 0,
    width: 1,
    speed: 0,
    halfLane: 1,
    puffX: new Float32Array(per),
    puffY: new Float32Array(per),
    puffSize: new Float32Array(per),
    puffOpacity: new Float32Array(per),
  }));

  const positions = new Float32Array(max * per * 3);
  const sizes = new Float32Array(max * per);
  const opacities = new Float32Array(max * per);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute("aOpacity", new THREE.BufferAttribute(opacities, 1).setUsage(THREE.DynamicDrawUsage));

  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      uPixelsPerUnit: { value: 500 },
      uColor: { value: new THREE.Color(...CLOUDS.color) },
      uCore: { value: CLOUDS.coreSoftness },
    },
    transparent: true,
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, material);
  points.name = "moon-clouds";
  points.frustumCulled = false;
  // After the moon and everything else opaque, so the clouds darken it.
  points.renderOrder = 10;
  const buffer = new THREE.Vector2();
  points.onBeforeRender = (renderer, _scene, camera) => {
    renderer.getDrawingBufferSize(buffer);
    const fov = (camera as THREE.PerspectiveCamera).fov ?? 45;
    material.uniforms.uPixelsPerUnit.value = buffer.y / (2 * Math.tan(THREE.MathUtils.degToRad(fov) / 2));
  };
  environment.add(points);

  // The lane's edge, in lane units: where the moon's disc ends as it appears on
  // the plane the clouds drift across.
  const laneRadius = moonRadius * (1 - CLOUDS.laneFraction);

  const spawn = (cloud: Cloud) => {
    cloud.alive = true;
    cloud.width = laneRadius * between(CLOUDS.widthMin, CLOUDS.widthMax);
    cloud.halfLane = laneRadius + cloud.width / 2;
    cloud.u = -cloud.halfLane;
    cloud.v = (Math.random() * 2 - 1) * laneRadius * CLOUDS.heightSpread;
    cloud.speed = (2 * cloud.halfLane) / between(CLOUDS.crossMinSeconds, CLOUDS.crossMaxSeconds);
    const height = cloud.width * CLOUDS.aspect;
    for (let i = 0; i < per; i++) {
      cloud.puffX[i] = bell() * cloud.width * 0.5;
      cloud.puffY[i] = bell() * height * 0.5;
      cloud.puffSize[i] = cloud.width * between(CLOUDS.puffSizeMin, CLOUDS.puffSizeMax);
      // Darkest at the cloud's centre, thinner towards its edges.
      const centre = Math.min(1, Math.hypot(cloud.puffX[i] / (cloud.width * 0.5), cloud.puffY[i] / (height * 0.5)));
      cloud.puffOpacity[i] = CLOUDS.puffOpacity * (1 - (1 - CLOUDS.edgeOpacity) * centre) * between(0.85, 1);
    }
  };

  let untilNext = between(1, 3);
  const camera = new THREE.Vector3();
  const toCamera = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  const lane = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();

  return {
    update(deltaSeconds) {
      points.visible = CLOUDS.enabled;
      if (!CLOUDS.enabled) return;
      const dt = Math.min(deltaSeconds, 0.1);

      untilNext -= dt;
      if (untilNext <= 0) {
        const free = clouds.find((cloud) => !cloud.alive);
        if (free) spawn(free);
        untilNext = between(CLOUDS.spawnMinSeconds, CLOUDS.spawnMaxSeconds);
      }

      // The lane faces the camera: across it is the camera's right, up its up.
      const view = getCamera();
      view.getWorldPosition(camera);
      view.getWorldQuaternion(quaternion);
      toCamera.copy(camera).sub(moonCenter);
      const distance = toCamera.length();
      toCamera.divideScalar(Math.max(distance, 1e-6));
      right.set(1, 0, 0).applyQuaternion(quaternion);
      right.addScaledVector(toCamera, -right.dot(toCamera)).normalize();
      up.crossVectors(toCamera, right);
      if (up.y < 0) up.negate();
      lane.copy(moonCenter).addScaledVector(toCamera, distance * CLOUDS.laneFraction);

      clouds.forEach((cloud, index) => {
        if (cloud.alive) {
          cloud.u += cloud.speed * dt;
          if (cloud.u > cloud.halfLane) cloud.alive = false;
        }
        const travelled = cloud.alive ? (cloud.u + cloud.halfLane) / (2 * cloud.halfLane) : 0;
        const fade = cloud.alive ? smooth(travelled / CLOUDS.fadeFraction) * smooth((1 - travelled) / CLOUDS.fadeFraction) : 0;
        for (let i = 0; i < per; i++) {
          const slot = index * per + i;
          const along = cloud.u + cloud.puffX[i];
          const high = cloud.v + cloud.puffY[i];
          positions[slot * 3] = lane.x + right.x * along + up.x * high;
          positions[slot * 3 + 1] = lane.y + right.y * along + up.y * high;
          positions[slot * 3 + 2] = lane.z + right.z * along + up.z * high;
          sizes[slot] = cloud.alive ? cloud.puffSize[i] : 0;
          opacities[slot] = cloud.puffOpacity[i] * fade;
        }
      });
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.aSize.needsUpdate = true;
      geometry.attributes.aOpacity.needsUpdate = true;
    },

    dispose() {
      points.removeFromParent();
      geometry.dispose();
      material.dispose();
    },
  };
}
