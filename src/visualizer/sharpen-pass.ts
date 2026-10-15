import * as THREE from "three";

// Draws the scene into a buffer and copies it to the canvas through a sharpen
// shader, instead of drawing straight to the canvas.
//
// The cards are the reason. A card fills about a fifth of the window's height,
// so its 350x490 face is squeezed into roughly 200 CSS pixels and read at a
// grazing angle across the fan: mipmapping softens the pips and numbers.
// Supersampling fixed that by drawing the whole scene several times over and
// shrinking it, which costs fill rate everywhere to sharpen one thing. This
// costs one extra pass over the screen instead, whatever the scene contains.
//
// The filter is contrast-adaptive: it subtracts a ring of neighbours from each
// pixel, so it lifts edges and leaves flat areas (the table, the dark
// surround) alone rather than amplifying their noise.

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// three applies tone mapping and the sRGB transfer only when it draws to the
// canvas; into a render target it leaves the colour linear and unmapped, so
// this pass has to finish the job or the whole scene shifts. The two functions
// below are three's own ACES filmic curve and sRGB encode, kept here so the
// buffer and the canvas agree on how a colour looks. Sharpening then happens
// after them, in display space, where the contrast threshold means something.
const FRAGMENT = /* glsl */ `
  precision highp float;
  uniform sampler2D tDiffuse;
  uniform vec2 texelSize;
  uniform float amount;
  uniform float fxaa;
  uniform float exposure;
  varying vec2 vUv;

  vec3 rrtAndOdtFit(vec3 v) {
    vec3 a = v * (v + 0.0245786) - 0.000090537;
    vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
    return a / b;
  }

  vec3 acesFilmic(vec3 color) {
    const mat3 inputMat = mat3(
      0.59719, 0.07600, 0.02840,
      0.35458, 0.90834, 0.13383,
      0.04823, 0.01566, 0.83777
    );
    const mat3 outputMat = mat3(
       1.60475, -0.10208, -0.00327,
      -0.53108,  1.10813, -0.07276,
      -0.07367, -0.00605,  1.07602
    );
    color *= exposure / 0.6;
    color = inputMat * color;
    color = rrtAndOdtFit(color);
    color = outputMat * color;
    return clamp(color, 0.0, 1.0);
  }

  vec3 toSRGB(vec3 color) {
    return mix(
      pow(color, vec3(0.41666)) * 1.055 - 0.055,
      color * 12.92,
      vec3(lessThanEqual(color, vec3(0.0031308)))
    );
  }

  vec3 display(vec2 uv) {
    return toSRGB(acesFilmic(texture2D(tDiffuse, uv).rgb));
  }

  float luma(vec3 color) {
    return dot(color, vec3(0.299, 0.587, 0.114));
  }

  // Edge-directed smoothing (after FXAA): where the four corners disagree
  // about brightness there is an edge, and the pixel is averaged along it
  // rather than across it. Flat areas, where the corners agree, are returned
  // untouched, so the cost and the softening are only where an edge is.
  vec3 smoothEdges(vec2 uv, vec3 rgbM) {
    vec3 rgbNW = display(uv + vec2(-1.0, -1.0) * texelSize);
    vec3 rgbNE = display(uv + vec2( 1.0, -1.0) * texelSize);
    vec3 rgbSW = display(uv + vec2(-1.0,  1.0) * texelSize);
    vec3 rgbSE = display(uv + vec2( 1.0,  1.0) * texelSize);
    float lumaM = luma(rgbM);
    float lumaNW = luma(rgbNW);
    float lumaNE = luma(rgbNE);
    float lumaSW = luma(rgbSW);
    float lumaSE = luma(rgbSE);
    float lumaMin = min(lumaM, min(min(lumaNW, lumaNE), min(lumaSW, lumaSE)));
    float lumaMax = max(lumaM, max(max(lumaNW, lumaNE), max(lumaSW, lumaSE)));
    if (lumaMax - lumaMin < max(0.0312, lumaMax * 0.125)) return rgbM;

    vec2 dir = vec2(
      -((lumaNW + lumaNE) - (lumaSW + lumaSE)),
       ((lumaNW + lumaSW) - (lumaNE + lumaSE))
    );
    float reduce = max((lumaNW + lumaNE + lumaSW + lumaSE) * 0.03125, 0.0078125);
    float scale = 1.0 / (min(abs(dir.x), abs(dir.y)) + reduce);
    dir = clamp(dir * scale, vec2(-6.0), vec2(6.0)) * texelSize;

    vec3 rgbA = 0.5 * (
      display(uv + dir * (1.0 / 3.0 - 0.5)) +
      display(uv + dir * (2.0 / 3.0 - 0.5))
    );
    vec3 rgbB = rgbA * 0.5 + 0.25 * (
      display(uv + dir * -0.5) +
      display(uv + dir * 0.5)
    );
    float lumaB = luma(rgbB);
    return (lumaB < lumaMin || lumaB > lumaMax) ? rgbA : rgbB;
  }

  void main() {
    vec3 middle = display(vUv);
    // Card pixels are marked in their alpha (see card-objects.ts): 0.5 for
    // the cards players read, left out of the smoothing so their art stays
    // as scanned; 0.25 for the stack, softened rather than sharpened.
    float marker = texture2D(tDiffuse, vUv).a;
    bool isCard = abs(marker - 0.5) < 0.12;
    bool isSoft = abs(marker - 0.25) < 0.12;
    if (fxaa > 0.0 && !isCard) middle = mix(middle, smoothEdges(vUv, middle), fxaa);

    // The four edge neighbours: a cross, not a box, so the filter follows
    // horizontal and vertical detail (card edges, numerals) without the
    // diagonal ringing a full 3x3 kernel gives.
    vec3 average = 0.25 * (
      display(vUv + vec2(texelSize.x, 0.0)) +
      display(vUv - vec2(texelSize.x, 0.0)) +
      display(vUv + vec2(0.0, texelSize.y)) +
      display(vUv - vec2(0.0, texelSize.y))
    );

    // The stack's paper edges: blurred over a few pixels, which melts the
    // sub-pixel stripes of its side into one tone, and never sharpened.
    if (isSoft) {
      vec3 sum = middle;
      for (int i = 1; i <= 3; i++) {
        float d = float(i);
        sum += display(vUv + vec2(0.0, texelSize.y * d)) + display(vUv - vec2(0.0, texelSize.y * d));
        sum += display(vUv + vec2(texelSize.x * d, 0.0)) + display(vUv - vec2(texelSize.x * d, 0.0));
      }
      gl_FragColor = vec4(sum / 13.0, 1.0);
      return;
    }

    // How much this pixel stands out from its neighbours; flat areas score
    // near zero and are left as they are.
    vec3 difference = middle - average;
    float contrast = max(max(abs(difference.r), abs(difference.g)), abs(difference.b));
    // Fades in over the first few percent of contrast, so gradients and the
    // torch glow stay smooth while real edges get the full amount.
    float weight = smoothstep(0.02, 0.15, contrast);

    gl_FragColor = vec4(clamp(middle + difference * amount * weight, 0.0, 1.0), 1.0);
  }
`;

export interface SharpenPass {
  // Renders the scene through the filter. Falls back to drawing straight to
  // the canvas if the buffer could not be made.
  render(scene: THREE.Scene, camera: THREE.Camera): void;
  setSize(width: number, height: number, pixelRatio: number): void;
  setAmount(amount: number): void;
  dispose(): void;
}

// `smoothing` is how much of the edge smoothing to apply, 0 to 1.
export function createSharpenPass(
  renderer: THREE.WebGLRenderer,
  amount: number,
  smoothing = 0,
): SharpenPass {
  // The scene's own render target. Depth is needed (this is a 3D scene);
  // stencil is not. HalfFloat keeps the tone mapping's headroom, since the
  // filter runs after the renderer's own output encoding.
  const target = new THREE.WebGLRenderTarget(1, 1, {
    depthBuffer: true,
    stencilBuffer: false,
    type: THREE.HalfFloatType,
  });
  target.texture.minFilter = THREE.LinearFilter;
  target.texture.magFilter = THREE.LinearFilter;
  target.texture.generateMipmaps = false;

  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      tDiffuse: { value: target.texture },
      texelSize: { value: new THREE.Vector2(1, 1) },
      amount: { value: amount },
      fxaa: { value: smoothing },
      exposure: { value: renderer.toneMappingExposure },
    },
    depthTest: false,
    depthWrite: false,
  });

  // One triangle covering the screen, drawn with no camera transform: cheaper
  // than a quad and free of the seam two triangles leave down the diagonal.
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  const quad = new THREE.Mesh(geometry, material);
  quad.frustumCulled = false;
  const quadScene = new THREE.Scene().add(quad);
  const quadCamera = new THREE.Camera();

  return {
    render(scene, camera) {
      // Exposure is a config value that can change between frames while it is
      // being tuned; the buffer has to follow it.
      material.uniforms.exposure.value = renderer.toneMappingExposure;
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(quadScene, quadCamera);
    },
    setSize(width, height, pixelRatio) {
      const w = Math.max(1, Math.floor(width * pixelRatio));
      const h = Math.max(1, Math.floor(height * pixelRatio));
      target.setSize(w, h);
      material.uniforms.texelSize.value.set(1 / w, 1 / h);
    },
    setAmount(next) {
      material.uniforms.amount.value = next;
    },
    dispose() {
      target.dispose();
      geometry.dispose();
      material.dispose();
    },
  };
}
