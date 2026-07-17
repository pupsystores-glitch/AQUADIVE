// AssetManager — sprite loading for the renderer (Sprint 2, Commit R4;
// docs/05_RENDERING_ARCHITECTURE.md §15). Deliberately tiny, shaped for
// growth (atlases, theme-scoped manifests, versioned URLs — documented in
// §15, not built).
//
// V1 manifest: one entry, the anchor sprite. Preload starts at module init,
// matching the previous eager module-scope `new Image()` in draw/anchor.ts —
// first-frame behavior is unchanged. A failed load leaves `ready = false`
// forever and logs once; the game keeps running on vector art (no retries).
//
// Rule (§15): no module-scope `new Image()` side effects outside this file;
// nothing else in the codebase touches asset URLs.

import anchorImgSrc from "@/assets/anchor.png";

export interface AssetHandle {
  readonly image: HTMLImageElement | null;
  readonly ready: boolean;
}

export type AssetManifest = Readonly<Record<string, string>>;

// `ready` reproduces the draw-time predicate the anchor blit used before R4
// (`img.complete && img.naturalWidth > 0`), so "draw nothing until loaded"
// — and "never draw a failed load" — behave exactly as they did.
class ImageHandle implements AssetHandle {
  constructor(readonly image: HTMLImageElement | null) {}

  get ready(): boolean {
    const img = this.image;
    return img !== null && img.complete && img.naturalWidth > 0;
  }
}

const NULL_HANDLE: AssetHandle = { image: null, ready: false };

class AssetManager {
  private readonly handles = new Map<string, ImageHandle>();

  /** Start loading every manifest entry; resolves when all have settled (loads never reject). */
  preload(manifest: AssetManifest): Promise<void> {
    const pending: Promise<void>[] = [];
    for (const [key, url] of Object.entries(manifest)) {
      if (this.handles.has(key)) continue;
      const image = typeof window !== "undefined" ? new Image() : null;
      this.handles.set(key, new ImageHandle(image));
      if (!image) continue;
      pending.push(
        new Promise<void>((resolve) => {
          image.onload = () => resolve();
          image.onerror = () => {
            console.error(`[rendering/assets] failed to load "${key}" (${url})`);
            resolve();
          };
          image.src = url;
        }),
      );
    }
    return Promise.all(pending).then(() => undefined);
  }

  get(key: AssetKey): AssetHandle {
    return this.handles.get(key) ?? NULL_HANDLE;
  }
}

/** V1 manifest (§15): the anchor sprite is the only sprite-based asset. */
const ASSET_MANIFEST = { anchor: anchorImgSrc } as const;

export type AssetKey = keyof typeof ASSET_MANIFEST;

export const assets = new AssetManager();

// Eager preload at module init — matches the pre-R4 module-scope load.
void assets.preload(ASSET_MANIFEST);
