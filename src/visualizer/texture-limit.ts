import * as THREE from "three";
import { RENDER } from "./config";

// The largest texture side characters keep: smaller on touch devices, where
// the browser shares graphics memory with the rest of the phone or tablet.
export function characterTextureLimit(): number {
  const touch = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  return touch ? RENDER.touchCharacterTextureSize : RENDER.characterTextureSize;
}

// Shrinks any texture in the model wider or taller than maxSize, before it
// reaches the GPU. The characters ship 4096px textures; at the size they are
// seen, 2048 or less looks the same and needs a quarter of the memory or less.
export async function limitTextureSizes(root: THREE.Object3D, maxSize: number): Promise<void> {
  const textures = new Set<THREE.Texture>();
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      for (const value of Object.values(material)) {
        if ((value as THREE.Texture | null)?.isTexture) textures.add(value as THREE.Texture);
      }
    }
  });

  await Promise.all(
    [...textures].map(async (texture) => {
      const image = texture.image as ImageBitmap | HTMLImageElement | undefined;
      const width = image?.width ?? 0;
      const height = image?.height ?? 0;
      if (!image || Math.max(width, height) <= maxSize) return;

      const scale = maxSize / Math.max(width, height);
      try {
        texture.image = await createImageBitmap(image, {
          resizeWidth: Math.round(width * scale),
          resizeHeight: Math.round(height * scale),
          resizeQuality: "high",
        });
        if (image instanceof ImageBitmap) image.close();
        texture.needsUpdate = true;
      } catch (error) {
        // Keep the full-size texture rather than none.
        console.warn("[textures] could not shrink a texture:", error);
      }
    }),
  );
}
