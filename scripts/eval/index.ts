/**
 * Detection measurement harness — see README.md in this folder.
 * Runs the app's REAL logic (perceptualHash, match, nutritionApi relevance,
 * foodLabels) under Node; the CLIP layer is optional (--clip) because it
 * downloads the model on first run.
 *
 *   node scripts/eval/index.ts [--data DIR] [--clip] [--sweep] [--labels]
 */
import './canvasShim.ts';
import { readdirSync, existsSync, statSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { loadImage, createCanvas } from 'canvas';

import {
  hashVariantsFromSource,
  hammingDistance,
  HASH_BITS,
  ROTATION_TRIALS_DEG,
} from '../../src/lib/perceptualHash.ts';
import {
  AUTO_ACCEPT_DISTANCE,
  AUTO_MATCH_THRESHOLD,
} from '../../src/lib/match.ts';
import { FOOD_LABEL_MAP } from '../../src/lib/foodLabels.ts';
import { makeDishCanvas, variantsOf, makeNotFoodCanvas, mulberry32, SYNTHETIC_DISHES } from './synthetic.ts';

// ---------------------------------------------------------------- args
const args = process.argv.slice(2);
const hasFlag = (f: string) => args.includes(f);
const optValue = (o: string, dflt: string) => {
  const i = args.indexOf(o);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};
const DATA_DIR = optValue('--data', resolve('scripts/eval/data'));
const RUN_CLIP = hasFlag('--clip');
const SWEEP = hasFlag('--sweep');

if (hasFlag('--labels')) {
  console.log(Object.keys(FOOD_LABEL_MAP).join('\n'));
  process.exit(0);
}

// ---------------------------------------------------------------- data
interface Photo {
  rel: string;             // for reporting
  expected: string;        // fine label, or special expectation below
  kind: 'seed' | 'same' | 'clip' | 'notfood'; // 'seed' photos only seed memory, not scored
  canvas: unknown;         // node-canvas Canvas, used as CanvasImageSource
  memoryName?: string;     // for kind 'same': which seeded entry it must match
}

async function loadRealDataset(): Promise<Photo[]> {
  if (!existsSync(DATA_DIR)) return [];
  const out: Photo[] = [];
  for (const labelDir of readdirSync(DATA_DIR)) {
    const dir = join(DATA_DIR, labelDir);
    if (!statSync(dir).isDirectory()) continue;
    const base = labelDir.split(':')[0];
    const files = readdirSync(dir).filter((f) => /\.(jpe?g|png)$/i.test(f));
    if (base === 'memory-same') {
      const name = labelDir.split(':')[1] ?? basename(labelDir);
      for (const f of files) out.push({ rel: `${labelDir}/${f}`, expected: name, kind: 'same', memoryName: name, canvas: await squareCanvas(join(dir, f)) });
    } else if (base === 'memory-different') {
      const name = labelDir.split(':')[1] ?? basename(labelDir);
      for (const f of files) out.push({ rel: `${labelDir}/${f}`, expected: `<not ${name}>`, kind: 'clip', memoryName: name, canvas: await squareCanvas(join(dir, f)) });
    } else if (base === 'not-food') {
      for (const f of files) out.push({ rel: `${labelDir}/${f}`, expected: 'null', kind: 'notfood', canvas: await squareCanvas(join(dir, f)) });
    } else {
      for (const f of files) out.push({ rel: `${labelDir}/${f}`, expected: labelDir, kind: 'clip', canvas: await squareCanvas(join(dir, f)) });
    }
  }
  return out;
}

/** Match the app: center-crop square like snapshotCanvas(). */
async function squareCanvas(file: string) {
  const img = await loadImage(file);
  const side = Math.min(img.width, img.height);
  const c = createCanvas(480, 480);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 480, 480);
  return c;
}

function buildSyntheticSet(): Photo[] {
  const out: Photo[] = [];
  const rng = mulberry32(1337);
  SYNTHETIC_DISHES.forEach(({ dish, pattern }) => {
    const base = makeDishCanvas(pattern, rng);
    // The plain shot is the synthetic "already logged this once" memory entry;
    // its camera-artifact variants are the second sightings that must match it.
    let isSeeder = true;
    for (const v of variantsOf(base, rng)) {
      if (isSeeder) {
        out.push({ rel: `synthetic/${dish}/${v.name}`, expected: dish, kind: 'seed', memoryName: undefined, canvas: v.canvas });
        isSeeder = false;
      } else {
        out.push({ rel: `synthetic/${dish}/${v.name}`, expected: dish, kind: 'same', memoryName: dish, canvas: v.canvas });
      }
    }
  });
  for (let i = 0; i < 3; i++) {
    out.push({ rel: `synthetic/notfood/${i}`, expected: 'null', kind: 'notfood', canvas: makeNotFoodCanvas(rng) });
  }
  return out;
}

// ---------------------------------------------------------------- memory
interface MemEntry {
  photoHash: string;
  photoHashes: string[];
  timesLogged: number;
}
interface MatchRow {
  rel: string;
  expected: string;
  memoryName: string | null;   // seeded memory group this photo belongs to (if any)
  ownDist: number | null;      // distance to its seeded memory entry
  foreignDist: number | null;  // closest WRONG memory entry — collision watch
  foreignName: string | null;
  claimed: 'auto' | 'confirm' | 'maybe' | 'miss';
}

function hashOf(canvas: unknown): string[] {
  return hashVariantsFromSource(canvas as never);
}

function evalHashLayer(photos: Photo[]): { rows: MatchRow[]; notFoodMinForeign: number | null } {
  // Seed memory entries from 'seed' photos (mirrors the app's stored hash on
  // first sighting), then score 'same' photos' variants against them.
  const memory = new Map<string, MemEntry>();
  for (const p of photos) {
    if (p.kind !== 'seed') continue;
    if (!memory.has(p.expected)) {
      memory.set(p.expected, { photoHash: hashOf(p.canvas)[0], photoHashes: [], timesLogged: 1 });
    }
  }
  // For real datasets using memory-same:NAME dirs, the first file in the dir
  // doubles as the seed when no explicit seed row exists.
  const seededWithFirstFile = new Set<string>();
  for (const p of photos) {
    if (p.kind === 'same' && p.memoryName && !memory.has(p.memoryName)) {
      memory.set(p.memoryName, { photoHash: hashOf(p.canvas)[0], photoHashes: [], timesLogged: 1 });
      seededWithFirstFile.add(p.memoryName);
    }
  }

  const rows: MatchRow[] = [];
  let notFoodMinForeign: number | null = null;

  for (const p of photos) {
    const variants = hashOf(p.canvas);
    const memArr = [...memory.entries()];
    let ownDist: number | null = null;
    let bestForeignDist: number | null = null;
    let bestForeignName: string | null = null;

    for (const [name, m] of memArr) {
      const entryHashes = [m.photoHash, ...m.photoHashes];
      let d = Infinity;
      for (const h of variants) for (const eh of entryHashes) d = Math.min(d, hammingDistance(h, eh));
      const isOwn = p.memoryName === name;
      if (isOwn) ownDist = d;
      else if (d < (bestForeignDist ?? Infinity)) { bestForeignDist = d; bestForeignName = name; }
    }

    if (p.kind === 'notfood') {
      if (bestForeignDist !== null) notFoodMinForeign = Math.min(notFoodMinForeign ?? Infinity, bestForeignDist);
      continue;
    }
    // The file that doubled as a memory seed trivially matches itself — keep
    // it out of the scored rows (self-identity would flatter the numbers).
    if (p.kind === 'same' && p.memoryName && seededWithFirstFile.has(p.memoryName)) {
      seededWithFirstFile.delete(p.memoryName);
      continue;
    }
    if (p.kind === 'seed') continue;

    let claimed: MatchRow['claimed'];
    if (p.kind === 'same') {
      claimed = ownDist === null ? 'miss'
        : ownDist <= AUTO_ACCEPT_DISTANCE ? 'auto'
        : ownDist <= AUTO_MATCH_THRESHOLD ? 'confirm'
        : ownDist <= 26 ? 'maybe' : 'miss';
    } else {
      claimed = (bestForeignDist ?? Infinity) <= AUTO_MATCH_THRESHOLD ? 'auto' : 'miss';
    }
    rows.push({
      rel: p.rel,
      expected: p.expected,
      memoryName: p.memoryName ?? null,
      ownDist,
      foreignDist: bestForeignDist,
      foreignName: bestForeignName,
      claimed,
    });
  }
  return { rows, notFoodMinForeign: notFoodMinForeign === Infinity ? null : notFoodMinForeign };
}

// ---------------------------------------------------------------- sweep
function hashSweep(photos: Photo[]) {
  const pairs: { same: number[]; foreign: number[] } = { same: [], foreign: [] };
  const memory = new Map<string, MemEntry>();
  for (const p of photos) {
    if (p.kind === 'seed' && !memory.has(p.expected)) {
      memory.set(p.expected, { photoHash: hashOf(p.canvas)[0], photoHashes: [], timesLogged: 1 });
    }
  }
  const seededWithFirstFile = new Set<string>();
  for (const p of photos) {
    if (p.kind === 'same' && p.memoryName && !memory.has(p.memoryName)) {
      memory.set(p.memoryName, { photoHash: hashOf(p.canvas)[0], photoHashes: [], timesLogged: 1 });
      seededWithFirstFile.add(p.memoryName);
    }
  }
  for (const p of photos) {
    if (p.kind !== 'same' || !p.memoryName) continue;
    if (seededWithFirstFile.has(p.memoryName)) { seededWithFirstFile.delete(p.memoryName); continue; }
    const variants = hashOf(p.canvas);
    for (const [name, m] of memory) {
      let d = Infinity;
      for (const h of variants) d = Math.min(d, hammingDistance(h, m.photoHash));
      if (name === p.memoryName) pairs.same.push(d);
      else pairs.foreign.push(d);
    }
  }
  const { same, foreign } = pairs;
  if (!same.length || !foreign.length) return;
  console.log(`\nhash distance sweep (n=${same.length} same-photo variants, ${foreign.length} cross-dish pairs)`);
  console.log('thr | same missed below thr | foreign falsely accepted below thr');
  for (let thr = 0; thr <= Math.floor(HASH_BITS / 2); thr += 2) {
    const miss = same.filter((d) => d > thr).length / same.length;
    const fp = foreign.filter((d) => d <= thr).length / foreign.length;
    const mark = (thr === AUTO_ACCEPT_DISTANCE || thr === AUTO_MATCH_THRESHOLD) ? '  <-- current' : '';
    console.log(`${String(thr).padStart(3)} | ${(miss * 100).toFixed(1).padStart(5)}% | ${(fp * 100).toFixed(1).padStart(5)}%${mark}`);
  }
  const sameMax = Math.max(...same);
  const foreignMin = Math.min(...foreign);
  console.log(`same-variant distances: min ${Math.min(...same)}, max ${sameMax}; foreign: min ${foreignMin}, max ${Math.max(...foreign)}`);
  console.log(`rotation variants hashed per capture: [${ROTATION_TRIALS_DEG.join(', ')}]°`);
}

// ---------------------------------------------------------------- CLIP
interface ClipRow { rel: string; expected: string; predicted: string | null; confident: boolean; probability: number | null; topK: string[] }

async function evalClipLayer(photos: Photo[]): Promise<ClipRow[]> {
  const rows: ClipRow[] = [];
  const { classifyFood } = await import('../../src/lib/foodClassifier.ts');
  for (const p of photos) {
    if (p.kind === 'same' || p.kind === 'seed') continue;
    // classifyEnriched would hit USDA — the eval scores the pure image model.
    const pred: { label: string; probability: number; topK?: { label: string; score: number }[] } | null = await (classifyFood as unknown as (c: unknown) => Promise<{ label: string; probability: number; topK?: { label: string; score: number }[] } | null>)(p.canvas)
      .catch(() => null);
    rows.push({
      rel: p.rel,
      expected: p.expected,
      predicted: pred?.label ?? null,
      confident: pred !== null,
      probability: pred?.probability ?? null,
      topK: (pred?.topK ?? []).slice(0, 3).map((t) => `${t.label}(${t.score.toFixed(2)})`),
    });
    process.stdout.write('.');
  }
  if (rows.length) console.log('');
  return rows;
}

// ---------------------------------------------------------------- report
function pct(x: number, n: number) { return n ? `${((x / n) * 100).toFixed(1)}%` : '—'; }

function reportHash(rows: MatchRow[], notFoodMinForeign: number | null) {
  const same = rows.filter((r) => r.ownDist !== null);
  const byDish = new Map<string, MatchRow[]>();
  for (const r of same) {
    const k = r.memoryName!;
    if (!byDish.has(k)) byDish.set(k, []);
    byDish.get(k)!.push(r);
  }
  console.log(`\n== hash layer (thresholds: auto ≤${AUTO_ACCEPT_DISTANCE}, confirm ≤${AUTO_MATCH_THRESHOLD}) ==`);
  console.log('dish'.padEnd(16), 'n', 'auto', 'confirm', 'miss', 'max own dist');
  for (const [dish, rs] of byDish) {
    const auto = rs.filter((r) => r.claimed === 'auto').length;
    const confirm = rs.filter((r) => r.claimed === 'confirm').length;
    const miss = rs.filter((r) => r.claimed === 'miss').length;
    const maxOwn = Math.max(...rs.map((r) => r.ownDist ?? -1));
    console.log(dish.padEnd(16), String(rs.length).padStart(2), pct(auto, rs.length).padStart(7), pct(confirm, rs.length).padStart(9), pct(miss, rs.length).padStart(6), String(maxOwn).padStart(8));
  }
  // The insidious failure: photo of dish X sits closer to dish Y's remembered
  // hash than to X's own — silently auto-logs the wrong food.
  const wrongWinner = same.filter((r) => (r.foreignDist ?? Infinity) < (r.ownDist ?? Infinity));
  if (wrongWinner.length) {
    console.log(`\ncollisions (foreign hash closer than own): ${wrongWinner.length}`);
    for (const r of wrongWinner) {
      console.log(`  ${r.rel}: own ${r.ownDist} vs ${r.foreignName} at ${r.foreignDist}`);
    }
  }
  const wrongAccept = rows.filter((r) => r.ownDist === null && r.claimed === 'auto');
  console.log(`foreign-photo false auto-accepts: ${wrongAccept.length}${wrongAccept.length ? ' — ' + wrongAccept.map((r) => `${r.rel}→${r.foreignName}@${r.foreignDist}`).join(', ') : ''}`);
  console.log(`not-food photos: closest memory distance = ${notFoodMinForeign ?? 'n/a'} (want > ${AUTO_MATCH_THRESHOLD}; a striped shirt must not auto-log lunch)`);
}

function reportClip(rows: ClipRow[]) {
  if (!rows.length) return;
  const food = rows.filter((r) => r.expected !== 'null' && !r.expected.startsWith('<not'));
  const notFood = rows.filter((r) => r.expected === 'null');
  const correct = food.filter((r) => r.predicted === r.expected).length;
  const confidentFood = food.filter((r) => r.confident);
  const confCorrect = confidentFood.filter((r) => r.predicted === r.expected).length;
  console.log('\n== CLIP layer ==');
  console.log(`top-1 (any prediction counts as miss when filtered): ${correct}/${food.length} = ${pct(correct, food.length)}`);
  console.log(`confident-only precision: ${confCorrect}/${confidentFood.length || 1} = ${pct(confCorrect, confidentFood.length || 0)}  (high = few silently-wrong auto-logs)`);
  console.log(`filtered-to-unknown on food: ${food.filter((r) => !r.confident).length}/${food.length} = ${pct(food.filter((r) => !r.confident).length, food.length)}`);
  if (notFood.length) {
    const escaped = notFood.filter((r) => r.confident);
    console.log(`not-food: predicted null on ${notFood.length - escaped.length}/${notFood.length} = ${pct(notFood.length - escaped.length, notFood.length)} (want 100%)${escaped.length ? ' — ESCAPED: ' + escaped.map((r) => `${r.rel}→${r.predicted}@${r.probability?.toFixed(2)}`).join(', ') : ''}`);
  }
  const misses = food.filter((r) => r.predicted !== r.expected);
  if (misses.length) {
    console.log('misses:');
    for (const m of misses) console.log(`  ${m.rel}: expected "${m.expected}", got ${m.predicted ? `"${m.predicted}" (${m.probability?.toFixed(2)})` : 'unknown'}  topK=[${m.topK.join(', ')}]`);
  }
}

// ---------------------------------------------------------------- main
const photos = [...(await loadRealDataset()), ...buildSyntheticSet()];
console.log(`photos: ${photos.length} (${photos.filter((p) => p.kind === 'seed').length} memory seeds, ${photos.filter((p) => p.kind === 'same').length} memory-same variants, ${photos.filter((p) => p.kind === 'clip').length} clip-only, ${photos.filter((p) => p.kind === 'notfood').length} not-food)`);

const { rows, notFoodMinForeign } = evalHashLayer(photos);
reportHash(rows, notFoodMinForeign);
if (SWEEP) hashSweep(photos);
if (RUN_CLIP) reportClip(await evalClipLayer(photos));

// Self-test: the pure pipeline must place same-photo variants dramatically
// closer than foreign dishes, or the report above is meaningless noise.
const sameOwnDists = rows.map((r) => r.ownDist).filter((d): d is number => d !== null);
const foreignDists = rows.flatMap((r) => (r.foreignDist !== null ? [r.foreignDist] : []));
if (sameOwnDists.length && foreignDists.length) {
  const sep = Math.min(...foreignDists) - Math.max(...sameOwnDists);
  console.log(`\nseparation: max same-variant ${Math.max(...sameOwnDists)} vs min foreign ${Math.min(...foreignDists)} (gap ${sep > 0 ? '+' : ''}${sep})`);
  if (sep < 0) {
    console.log(
      'NOTE: split same/foreign MEANS by threshold in the sweep rather than chasing a single extreme — ' +
        'cartoon plates share geometry and extremes on the synthetic corpus overstate overlap. ' +
        'Point --data at real shots for any threshold decision.',
    );
  }
}
