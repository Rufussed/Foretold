import { CARDS } from "./config";

// Wears a card's edges: a cream vignette broken up with noise, as if the card
// has been handled. Applied to the art before the number is printed, so the
// lettering stays crisp over it.

const TILE = 256;

// Tileable noise: smooth value noise at two scales plus per-pixel grain, in
// 0..1. Made once and shared; each card reads it from its own offset, so no
// two cards wear the same way and none costs a noise evaluation per pixel.
let tile: Float32Array | null = null;

function noiseTile(): Float32Array {
  if (tile) return tile;

  // A small deterministic generator, so the wear is the same on every load.
  let state = 0x9e3779b9;
  const random = (): number => {
    state = (Math.imul(state ^ (state >>> 15), 0x2c1b3c6d) + 0x297a2d39) >>> 0;
    return state / 0xffffffff;
  };

  const octave = (cell: number): Float32Array => {
    const cells = TILE / cell;
    const lattice = Float32Array.from({ length: cells * cells }, random);
    const values = new Float32Array(TILE * TILE);
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const gx = x / cell;
        const gy = y / cell;
        const x0 = Math.floor(gx);
        const y0 = Math.floor(gy);
        // Smoothstep the fraction so cell borders don't show as a grid.
        const fx = (gx - x0) * (gx - x0) * (3 - 2 * (gx - x0));
        const fy = (gy - y0) * (gy - y0) * (3 - 2 * (gy - y0));
        const at = (cx: number, cy: number): number => lattice[(cy % cells) * cells + (cx % cells)];
        const top = at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx;
        const bottom = at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx;
        values[y * TILE + x] = top * (1 - fy) + bottom * fy;
      }
    }
    return values;
  };

  const coarse = octave(32);
  const fine = octave(8);
  tile = new Float32Array(TILE * TILE);
  for (let i = 0; i < tile.length; i++) {
    tile[i] = coarse[i] * 0.5 + fine[i] * 0.3 + random() * 0.2;
  }
  return tile;
}

// A small whole number from a string, to place a card on the noise tile.
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

const smoothstep = (t: number): number => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

// `seed` picks where on the noise this card reads, so cards differ.
export function wearCard(context: CanvasRenderingContext2D, width: number, height: number, seed: string): void {
  const wear = CARDS.wear;
  if (wear.strength <= 0) return;

  const noise = noiseTile();
  const h = hash(seed);
  const offsetX = h & (TILE - 1);
  const offsetY = (h >>> 8) & (TILE - 1);

  const [r, g, b] = [1, 3, 5].map((i) => parseInt(wear.color.slice(i, i + 2), 16));
  const reach = wear.width * width;
  const rough = wear.roughness * width;
  const rim = wear.rim;
  const [rimR, rimG, rimB] = [1, 3, 5].map((i) => parseInt(rim.color.slice(i, i + 2), 16));
  const rimReach = rim.width * width;
  // The card's corners are rounded to this radius (measured off the mesh), so
  // distance from the edge is taken from the rounded outline, not a rectangle.
  const corner = wear.cornerRadius * width;

  const image = context.getImageData(0, 0, width, height);
  const data = image.data;
  for (let y = 0; y < height; y++) {
    const fromTopBottom = Math.min(y, height - 1 - y);
    for (let x = 0; x < width; x++) {
      const fromSide = Math.min(x, width - 1 - x);
      // In a corner, the distance in from the arc; elsewhere from the nearest side.
      const edge =
        fromSide < corner && fromTopBottom < corner
          ? Math.max(0, corner - Math.hypot(corner - fromSide, corner - fromTopBottom))
          : Math.min(fromTopBottom, fromSide);
      // Past the reach plus the most the noise can pull it back, nothing to do.
      if (edge > reach + rough) continue;

      const n = noise[((y + offsetY) & (TILE - 1)) * TILE + ((x + offsetX) & (TILE - 1))];
      const at = (y * width + x) * 4;

      // The cream wear first, then the dark rim over it on the very edge.
      const worn = wearAmount(edge, n, reach, rough, wear.strength, wear.grain);
      if (worn > 0) {
        data[at] += (r - data[at]) * worn;
        data[at + 1] += (g - data[at + 1]) * worn;
        data[at + 2] += (b - data[at + 2]) * worn;
      }

      if (rim.strength > 0 && edge < rimReach) {
        // Strongest at the edge itself, fading to nothing across its width, and
        // broken up by the noise so it reads as handled edge, not a drawn line.
        const rimAmount =
          smoothstep(1 - edge / rimReach) * rim.strength * (1 - rim.grain + rim.grain * n * 2);
        data[at] += (rimR - data[at]) * rimAmount;
        data[at + 1] += (rimG - data[at + 1]) * rimAmount;
        data[at + 2] += (rimB - data[at + 2]) * rimAmount;
      }
    }
  }
  context.putImageData(image, 0, 0);
}

// How much of the wear colour a pixel takes: its distance from the edge, moved
// about by the noise so the wear creeps in unevenly, then speckled by grain.
function wearAmount(edge: number, n: number, reach: number, rough: number, strength: number, grain: number): number {
  const distance = edge + (n - 0.5) * 2 * rough;
  return Math.max(0, smoothstep(1 - distance / reach) * strength * (1 - grain + grain * n * 2));
}
