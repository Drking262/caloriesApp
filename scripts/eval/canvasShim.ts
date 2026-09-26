/**
 * Installs just enough browser-Canvas surface for src/lib/perceptualHash.ts
 * to run unmodified under Node. perceptualHash only ever calls
 * `document.createElement('canvas')`, `.getContext('2d')`,
 * `drawImage`, `getImageData`, and `toDataURL` — all provided by the
 * `canvas` package (Cairo-backed), which is API-compatible with these.
 *
 * Keep this shim minimal on purpose: if the harness starts needing more
 * browser API than this, the right move is extracting that logic into a
 * DOM-free module, not growing the shim.
 */
import { createCanvas } from 'canvas';

const g = globalThis as unknown as { document?: unknown };
if (!g.document) {
  g.document = {
    createElement(tag: string) {
      if (tag !== 'canvas') throw new Error(`canvasShim: unsupported element <${tag}>`);
      return createCanvas(1, 1);
    },
  };
}
