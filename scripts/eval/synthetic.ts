/**
 * Deterministic synthetic "plates" so the hash layer can be measured even
 * with no real photo dataset on disk. Each make* generator draws at phone
 * resolution (480×480, same square the camera pipeline hashes) with a
 * seeded RNG, and variantsOf() replays the pipeline's own augmentation
 * space: handheld tilt, reframing, and exposure shifts — the three things
 * hashVariantsFromSource / AUTO_MATCH_THRESHOLD claim robustness to.
 */
import { createCanvas, type Canvas } from 'canvas';

const SIZE = 480;

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Pattern = 'rings' | 'chunks' | 'grid-leaves' | 'stripes' | 'broth';

/** A "dish" is a base pattern + palette; variants add camera artifacts. */
export function makeDishCanvas(pattern: Pattern, rng: () => number): Canvas {
  const c = createCanvas(SIZE, SIZE);
  const ctx = c.getContext('2d');

  // tablecloth
  const table = 28 + rng() * 22;
  ctx.fillStyle = `rgb(${table | 0},${(table * 0.95) | 0},${(table * 0.9) | 0})`;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // plate — jitter its size/center/shade per dish too, otherwise every dish
  // shares the plate's exact bright disc and per-dish food differences only
  // move a handful of hash bits (the 9×8 gradient mostly sees plate+rim).
  const cx = SIZE / 2 + (rng() - 0.5) * 24, cy = SIZE / 2 + (rng() - 0.5) * 24, R = 182 + rng() * 32;
  const plateShade = 218 + (rng() - 0.5) * 16;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = `rgb(${plateShade | 0},${(plateShade - 1) | 0},${(plateShade - 5) | 0})`;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, R * (0.82 + rng() * 0.08), 0, Math.PI * 2);
  ctx.fillStyle = `rgb(${(plateShade + 12) | 0},${(plateShade + 12) | 0},${(plateShade + 9) | 0})`;
  ctx.fill();

  const blob = (x: number, y: number, r: number, color: string) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  };
  const inPlate = () => {
    const a = rng() * Math.PI * 2;
    const d = rng() * R * 0.7;
    return [cx + Math.cos(a) * d, cy + Math.sin(a) * d] as const;
  };

  switch (pattern) {
    case 'rings': {
      // stew/goulash: dark base with glossy rings
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.8, 0, Math.PI * 2); ctx.fillStyle = 'rgb(110,62,28)'; ctx.fill();
      for (let i = 0; i < 14; i++) {
        const [x, y] = inPlate();
        ctx.beginPath(); ctx.arc(x, y, 24 + rng() * 30, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${140 + rng() * 40 | 0},${80 + rng() * 30 | 0},40,0.8)`;
        ctx.lineWidth = 5 + rng() * 8; ctx.stroke();
      }
      break;
    }
    case 'chunks': {
      // schnitzel/fries: big tan blocks
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.8, 0, Math.PI * 2); ctx.fillStyle = 'rgb(214,178,110)'; ctx.fill();
      for (let i = 0; i < 10; i++) { const [x, y] = inPlate(); blob(x, y, 30 + rng() * 42, `rgb(${190 + rng() * 50 | 0},${150 + rng() * 40 | 0},${80 + rng() * 40 | 0})`); }
      break;
    }
    case 'grid-leaves': {
      // salad: many green strokes
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.8, 0, Math.PI * 2); ctx.fillStyle = 'rgb(70,110,52)'; ctx.fill();
      for (let i = 0; i < 60; i++) {
        const [x, y] = inPlate();
        ctx.save(); ctx.translate(x, y); ctx.rotate(rng() * Math.PI);
        ctx.strokeStyle = `rgba(${40 + rng() * 60 | 0},${110 + rng() * 60 | 0},${40 + rng() * 40 | 0},0.9)`;
        ctx.lineWidth = 4 + rng() * 7; ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(18, 0); ctx.stroke(); ctx.restore();
      }
      break;
    }
    case 'stripes': {
      // grilled meat: sear stripes
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.8, 0, Math.PI * 2); ctx.fillStyle = 'rgb(96,52,30)'; ctx.fill();
      ctx.strokeStyle = 'rgba(40,20,10,0.85)'; ctx.lineWidth = 10;
      for (let i = -5; i <= 5; i++) { ctx.beginPath(); ctx.moveTo(0, cy + i * 26); ctx.lineTo(SIZE, cy + i * 26 + rng() * 12); ctx.stroke(); }
      break;
    }
    case 'broth': {
      // soup: light glossy disc with a few floaters
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.8, 0, Math.PI * 2); ctx.fillStyle = 'rgb(222,190,130)'; ctx.fill();
      for (let i = 0; i < 6; i++) { const [x, y] = inPlate(); blob(x, y, 8 + rng() * 14, 'rgb(120,90,40)'); }
      break;
    }
  }
  return c;
}

/** Camera artifacts the hash claims robustness to. Rotation > 8° exceeds
 * ROTATION_TRIALS_DEG and is *expected* to degrade — that's measured, not hidden. */
export function variantsOf(base: Canvas, rng: () => number): { name: string; canvas: Canvas }[] {
  const out: { name: string; canvas: Canvas }[] = [{ name: 'plain', canvas: base }];
  const rots = [3, 7, 12];
  for (const deg of rots) {
    const c = createCanvas(SIZE, SIZE);
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgb(24,23,22)'; ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.save(); ctx.translate(SIZE / 2, SIZE / 2); ctx.rotate((deg * Math.PI) / 180); ctx.drawImage(base as never, -SIZE / 2, -SIZE / 2); ctx.restore();
    exposure(ctx, 0.92 + rng() * 0.24);
    out.push({ name: `rot${deg}`, canvas: c });
  }
  { // crop / reframe
    const c = createCanvas(SIZE, SIZE);
    const ctx = c.getContext('2d');
    const ox = (rng() - 0.5) * 40, oy = (rng() - 0.5) * 40;
    ctx.drawImage(base as never, ox - 12, oy - 12, SIZE + 24, SIZE + 24);
    exposure(ctx, 0.92 + rng() * 0.24);
    out.push({ name: 'crop', canvas: c });
  }
  { // pure exposure
    const c = createCanvas(SIZE, SIZE);
    const ctx = c.getContext('2d');
    ctx.drawImage(base as never, 0, 0);
    exposure(ctx, 0.8);
    out.push({ name: 'dark', canvas: c });
  }
  return out;
}

function exposure(ctx: ReturnType<Canvas['getContext']>, factor: number) {
  const img = ctx.getImageData(0, 0, SIZE, SIZE);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] *= factor; d[i + 1] *= factor; d[i + 2] *= factor;
  }
  ctx.putImageData(img, 0, 0);
}

/** For the not-food row: hands, tables, empty frames. */
export function makeNotFoodCanvas(rng: () => number): Canvas {
  const c = createCanvas(SIZE, SIZE);
  const ctx = c.getContext('2d');
  ctx.fillStyle = `rgb(${150 + rng() * 60 | 0},${130 + rng() * 50 | 0},${120 + rng() * 40 | 0})`;
  ctx.fillRect(0, 0, SIZE, SIZE);
  for (let i = 0; i < 8; i++) {
    ctx.strokeStyle = `rgba(${90 + rng() * 60 | 0},${70 + rng() * 50 | 0},${60 + rng() * 40 | 0},0.6)`;
    ctx.lineWidth = 14 + rng() * 26;
    ctx.beginPath(); ctx.moveTo(rng() * SIZE, rng() * SIZE); ctx.lineTo(rng() * SIZE, rng() * SIZE); ctx.stroke();
  }
  return c;
}

export const SYNTHETIC_DISHES: { dish: string; pattern: Pattern }[] = [
  { dish: 'goulash', pattern: 'rings' },
  { dish: 'schnitzel', pattern: 'chunks' },
  { dish: 'salad', pattern: 'grid-leaves' },
  { dish: 'steak', pattern: 'stripes' },
  { dish: 'soup', pattern: 'broth' },
];
