import * as THREE from "three";
import { SPARKS } from "./config";
import { torchFlames } from "./environment-setup";

export interface TorchSparks {
  update(deltaSeconds: number): void;
  dispose(): void;
}

const vary = (value: number, randomness: number) => value * (1 + (Math.random() * 2 - 1) * randomness);

const VERTEX = /* glsl */ `
  attribute float aSize;
  attribute float aGlow;
  attribute float aAge;
  uniform float uPixelsPerUnit;
  varying float vGlow;
  varying float vAge;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPixelsPerUnit / max(-mv.z, 0.001);
    vGlow = aGlow;
    vAge = aAge;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 uColorStart;
  uniform vec3 uColorEnd;
  uniform float uBrightness;
  varying float vGlow;
  varying float vAge;
  void main() {
    // A soft round dot, brightest in the middle.
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float falloff = smoothstep(1.0, 0.0, d);
    vec3 color = mix(uColorStart, uColorEnd, vAge) * uBrightness;
    gl_FragColor = vec4(color * falloff * vGlow, falloff * vGlow);
  }
`;

// Sparks rising from every torch flame in the scene: each flares, drifts with
// the shared wind, weaves in a sine wave across it, and dies. See SPARKS.
export function createTorchSparks(environment: THREE.Object3D): TorchSparks {
  const flames = torchFlames(environment);
  const max = SPARKS.maxParticles;

  // Per spark: where it started along the drift (base), its wave and life.
  const base = new Float32Array(max * 3);
  const velocity = new Float32Array(max);
  const age = new Float32Array(max);
  const life = new Float32Array(max);
  const waveFrequency = new Float32Array(max);
  const waveAmplitude = new Float32Array(max);
  const phase = new Float32Array(max);
  const baseSize = new Float32Array(max);
  const alive = new Uint8Array(max);

  const positions = new Float32Array(max * 3);
  const sizes = new Float32Array(max);
  const glows = new Float32Array(max);
  const ages = new Float32Array(max);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute("aGlow", new THREE.BufferAttribute(glows, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute("aAge", new THREE.BufferAttribute(ages, 1).setUsage(THREE.DynamicDrawUsage));

  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      uPixelsPerUnit: { value: 500 },
      uColorStart: { value: new THREE.Color(...SPARKS.colorStart) },
      uColorEnd: { value: new THREE.Color(...SPARKS.colorEnd) },
      uBrightness: { value: SPARKS.brightness },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geometry, material);
  points.name = "torch-sparks";
  points.frustumCulled = false;
  // Point size in pixels depends on the camera and the drawing buffer.
  const buffer = new THREE.Vector2();
  points.onBeforeRender = (renderer, _scene, camera) => {
    renderer.getDrawingBufferSize(buffer);
    const fov = (camera as THREE.PerspectiveCamera).fov ?? 45;
    material.uniforms.uPixelsPerUnit.value = buffer.y / (2 * Math.tan(THREE.MathUtils.degToRad(fov) / 2));
  };
  environment.add(points);

  // The shared drift: eases from one direction to the next, then picks another.
  const randomWind = () =>
    new THREE.Vector3(Math.random() * 2 - 1, (Math.random() * 2 - 1) * SPARKS.windVertical, Math.random() * 2 - 1).normalize();
  let windFrom = randomWind();
  let windTo = randomWind();
  let windProgress = 0;
  const wind = windFrom.clone();
  const across = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);

  const emitters = flames.map(() => ({ owed: Math.random() }));
  const flamePosition = new THREE.Vector3();
  let next = 0;

  const spawn = (origin: THREE.Vector3) => {
    // Reuse the next dead slot, if any.
    for (let tries = 0; tries < max; tries++) {
      const i = (next + tries) % max;
      if (alive[i]) continue;
      next = (i + 1) % max;
      alive[i] = 1;
      // Inside the flame, scattered a little.
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.sqrt(Math.random()) * SPARKS.emitRadius;
      base[i * 3] = origin.x + Math.cos(angle) * radius;
      base[i * 3 + 1] = origin.y + SPARKS.emitOffsetY + (Math.random() - 0.5) * SPARKS.emitRadius;
      base[i * 3 + 2] = origin.z + Math.sin(angle) * radius;
      velocity[i] = SPARKS.speedMin + Math.random() * (SPARKS.speedMax - SPARKS.speedMin);
      age[i] = 0;
      life[i] = Math.max(SPARKS.lifeMinSeconds + Math.random() * (SPARKS.lifeMaxSeconds - SPARKS.lifeMinSeconds), 0.1);
      waveFrequency[i] = vary(SPARKS.waveFrequency, SPARKS.waveRandomness);
      waveAmplitude[i] = vary(SPARKS.waveAmplitude, SPARKS.waveRandomness);
      phase[i] = Math.random() * Math.PI * 2;
      baseSize[i] = Math.max(vary(SPARKS.size, SPARKS.sizeRandomness), 0);
      return;
    }
  };

  return {
    update(deltaSeconds) {
      if (!SPARKS.enabled) {
        points.visible = false;
        return;
      }
      points.visible = true;
      const dt = Math.min(deltaSeconds, 0.1);

      windProgress += dt / SPARKS.windChangeSeconds;
      if (windProgress >= 1) {
        windFrom = windTo;
        windTo = randomWind();
        windProgress = 0;
      }
      const eased = windProgress * windProgress * (3 - 2 * windProgress);
      wind.copy(windFrom).lerp(windTo, eased).normalize();
      // Sideways to the drift, for the weave.
      across.crossVectors(wind, UP);
      if (across.lengthSq() < 1e-6) across.set(1, 0, 0);
      across.normalize();

      environment.updateMatrixWorld();
      flames.forEach((flame, index) => {
        const emitter = emitters[index]!;
        emitter.owed += SPARKS.perTorchPerSecond * dt;
        flame.getWorldPosition(flamePosition);
        environment.worldToLocal(flamePosition);
        while (emitter.owed >= 1) {
          emitter.owed -= 1;
          spawn(flamePosition);
        }
      });

      for (let i = 0; i < max; i++) {
        if (!alive[i]) {
          glows[i] = 0;
          sizes[i] = 0;
          continue;
        }
        age[i] += dt;
        const t = age[i] / life[i];
        if (t >= 1) {
          alive[i] = 0;
          glows[i] = 0;
          sizes[i] = 0;
          continue;
        }
        // Drift with the wind plus a rise; weave across the drift.
        const speed = velocity[i];
        base[i * 3] += (wind.x * speed) * dt;
        base[i * 3 + 1] += (wind.y * speed + SPARKS.rise) * dt;
        base[i * 3 + 2] += (wind.z * speed) * dt;
        const weave = Math.sin(age[i] * waveFrequency[i] * Math.PI * 2 + phase[i]) * waveAmplitude[i];
        positions[i * 3] = base[i * 3] + across.x * weave;
        positions[i * 3 + 1] = base[i * 3 + 1] + across.y * weave;
        positions[i * 3 + 2] = base[i * 3 + 2] + across.z * weave;

        // Flare up quickly, then fade out.
        const flare = SPARKS.flareFraction;
        const glow = t < flare ? t / flare : Math.pow(1 - (t - flare) / (1 - flare), 2);
        glows[i] = glow;
        sizes[i] = baseSize[i] * (0.6 + 0.4 * glow);
        ages[i] = t;
      }

      for (const name of ["position", "aSize", "aGlow", "aAge"]) {
        (geometry.getAttribute(name) as THREE.BufferAttribute).needsUpdate = true;
      }
    },

    dispose() {
      points.removeFromParent();
      geometry.dispose();
      material.dispose();
    },
  };
}
