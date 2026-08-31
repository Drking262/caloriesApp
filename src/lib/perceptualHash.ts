/**
 * Client-side food recognition, without any network call or model weights.
 *
 * We compute a 64-bit difference hash (dHash) of the captured frame: shrink
 * it to 9x8 grayscale and record, per row, whether each pixel is brighter
 * than its neighbor. Two photos of the same plate — same shape, same
 * plating, similar framing — land on hashes a small Hamming distance apart,
 * even under different lighting, because dHash only encodes gradients, not
 * absolute brightness. It is not object recognition; it is "have I seen
 * this shape before," which is exactly what a *memory* of already-logged
 * food needs.
 *
 * Measured against real photos (see repo history), this hash is robust to
 * JPEG re-compression, exposure changes, and modest reframing/crop — but a
 * single hash is fragile to camera *rotation*: even a 2-3° tilt between two
 * shots of the same plate can push the distance past a naive threshold.
 * `hashVariantsFromSource` compensates by hashing the capture at a small
 * spread of rotation corrections and letting the matcher try all of them —
 * see `rankMatches` in lib/match.ts, which takes the best (minimum)
 * distance across variants against each remembered photo.
 */

const HASH_COLS = 9;
const HASH_ROWS = 8;
export const HASH_BITS = (HASH_COLS - 1) * HASH_ROWS; // 64

/** Rotation corrections (degrees) tried at match time against the stored,
 * unrotated reference hash. Calibrated empirically: catches up to ~5° of
 * handheld tilt between two shots while staying well clear of the distance
 * seen between genuinely different foods. */
export const ROTATION_TRIALS_DEG = [0, -8, -4, 4, 8];

let hashCanvas: HTMLCanvasElement | null = null;

function getHashCanvas(): HTMLCanvasElement {
  if (!hashCanvas) {
    hashCanvas = document.createElement('canvas');
    hashCanvas.width = HASH_COLS;
    hashCanvas.height = HASH_ROWS;
  }
  return hashCanvas;
}

function reduceToHash(ctx: CanvasRenderingContext2D): string {
  const { data } = ctx.getImageData(0, 0, HASH_COLS, HASH_ROWS);

  const gray = new Float32Array(HASH_COLS * HASH_ROWS);
  for (let i = 0; i < gray.length; i++) {
    const o = i * 4;
    gray[i] = data[o] * 0.299 + data[o + 1] * 0.587 + data[o + 2] * 0.114;
  }

  let bits = '';
  let nibble = 0;
  let nibbleLen = 0;
  const pushBit = (bit: number) => {
    nibble = (nibble << 1) | bit;
    nibbleLen++;
    if (nibbleLen === 4) {
      bits += nibble.toString(16);
      nibble = 0;
      nibbleLen = 0;
    }
  };

  for (let row = 0; row < HASH_ROWS; row++) {
    for (let col = 0; col < HASH_COLS - 1; col++) {
      const left = gray[row * HASH_COLS + col];
      const right = gray[row * HASH_COLS + col + 1];
      pushBit(left < right ? 1 : 0);
    }
  }
  if (nibbleLen > 0) bits += (nibble << (4 - nibbleLen)).toString(16);
  return bits;
}

/** The canonical, unrotated hash — what gets stored on a memory entry. */
export function hashFromSource(source: CanvasImageSource): string {
  const canvas = getHashCanvas();
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2d context unavailable');
  ctx.drawImage(source, 0, 0, HASH_COLS, HASH_ROWS);
  return reduceToHash(ctx);
}

const WORK_SIZE = 64;
let workCanvas: HTMLCanvasElement | null = null;

function getWorkCanvas(): HTMLCanvasElement {
  if (!workCanvas) {
    workCanvas = document.createElement('canvas');
    workCanvas.width = WORK_SIZE;
    workCanvas.height = WORK_SIZE;
  }
  return workCanvas;
}

function hashFromRotatedSource(source: CanvasImageSource, degrees: number): string {
  const work = getWorkCanvas();
  const workCtx = work.getContext('2d', { willReadFrequently: true });
  if (!workCtx) throw new Error('2d context unavailable');
  workCtx.save();
  workCtx.clearRect(0, 0, WORK_SIZE, WORK_SIZE);
  workCtx.translate(WORK_SIZE / 2, WORK_SIZE / 2);
  workCtx.rotate((degrees * Math.PI) / 180);
  workCtx.drawImage(source, -WORK_SIZE / 2, -WORK_SIZE / 2, WORK_SIZE, WORK_SIZE);
  workCtx.restore();

  const canvas = getHashCanvas();
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2d context unavailable');
  ctx.drawImage(work, 0, 0, HASH_COLS, HASH_ROWS);
  return reduceToHash(ctx);
}

/** Hashes of the capture at ROTATION_TRIALS_DEG corrections, for matching
 * against memory. Index 0 is always the plain, unrotated hash — use that
 * one when *storing* a new memory entry's reference photoHash. */
export function hashVariantsFromSource(source: CanvasImageSource): string[] {
  return ROTATION_TRIALS_DEG.map((deg) => (deg === 0 ? hashFromSource(source) : hashFromRotatedSource(source, deg)));
}

export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return HASH_BITS;
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) {
      dist += x & 1;
      x >>= 1;
    }
  }
  return dist;
}

/** 1 = identical hash, 0 = maximally different */
export function similarity(a: string, b: string): number {
  return 1 - hammingDistance(a, b) / HASH_BITS;
}

export function thumbnailFromSource(source: CanvasImageSource, size = 160): string {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.drawImage(source, 0, 0, size, size);
  return canvas.toDataURL('image/jpeg', 0.6);
}
