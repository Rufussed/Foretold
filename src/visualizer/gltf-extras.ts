// Reads Blender custom properties out of the glTF scene. Blender writes them
// into `extras` on whichever datablock they were set on, and PlayCanvas
// ignores `extras` entirely apart from morph target names — so scene.ts hands
// the raw glTF JSON here (via the container asset's global postprocess hook)
// and looks settings up by name.

export type Extras = Record<string, unknown>;

interface GltfNode {
  name?: string;
  extras?: Extras;
}

interface GltfAnimation {
  name?: string;
  extras?: Extras;
  channels?: { target?: { node?: number } }[];
}

interface GltfJson {
  nodes?: GltfNode[];
  animations?: GltfAnimation[];
  scenes?: { extras?: Extras }[];
  scene?: number;
}

export interface GltfExtrasIndex {
  scene: Extras;
  node: (name: string) => Extras;
  animation: (name: string) => Extras;
}

const EMPTY: Extras = Object.freeze({});

export function emptyGltfExtrasIndex(): GltfExtrasIndex {
  return { scene: EMPTY, node: () => EMPTY, animation: () => EMPTY };
}

export function indexGltfExtras(raw: unknown): GltfExtrasIndex {
  const gltf = raw as GltfJson | null;
  if (!gltf) return emptyGltfExtrasIndex();

  const nodes = gltf.nodes ?? [];

  const byNodeName = new Map<string, Extras>();
  nodes.forEach((node) => {
    if (node.name && node.extras) byNodeName.set(node.name, node.extras);
  });

  const byAnimationName = new Map<string, Extras>();
  (gltf.animations ?? []).forEach((animation) => {
    if (!animation.name) return;

    // A property like `loop` is usually set on the object being animated (the
    // Camera), not on the Action, so fall back to the extras of every node
    // this clip drives. The clip's own extras win on conflict.
    const targeted: Extras = {};
    animation.channels?.forEach((channel) => {
      const index = channel.target?.node;
      if (index === undefined) return;
      Object.assign(targeted, nodes[index]?.extras);
    });

    byAnimationName.set(animation.name, { ...targeted, ...animation.extras });
  });

  const sceneExtras =
    (gltf.scenes ?? [])[gltf.scene ?? 0]?.extras ?? EMPTY;

  return {
    scene: sceneExtras,
    node: (name) => byNodeName.get(name) ?? EMPTY,
    animation: (name) => byAnimationName.get(name) ?? EMPTY,
  };
}

// Blender custom properties come through as numbers (0/1) for float and int
// props, and as real booleans only for bool props.
export function extrasBoolean(
  extras: Extras,
  key: string,
  fallback: boolean,
): boolean {
  const value = extras[key];
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    if (value === "0" || value.toLowerCase() === "false") return false;
    if (value === "1" || value.toLowerCase() === "true") return true;
  }
  return fallback;
}

export function extrasNumber(
  extras: Extras,
  key: string,
  fallback: number,
): number {
  const value = extras[key];
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return fallback;
}
