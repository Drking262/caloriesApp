import { shouldSkipLiveEnrichment, isConfident, foldTemplates } from './foodClassifier.ts';

function assertEqual(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`FAIL ${label}\n  actual:   ${a}\n  expected: ${e}`);
  console.log(`ok - ${label}`);
}

function assertApproxArray(actual: number[], expected: number[], label: string) {
  if (actual.length !== expected.length || actual.some((v, i) => Math.abs(v - expected[i]) > 1e-9)) {
    throw new Error(`FAIL ${label}\n  actual:   ${JSON.stringify(actual)}\n  expected: ${JSON.stringify(expected)}`);
  }
  console.log(`ok - ${label}`);
}

// A Czech label with an English gloss in parens — this exact case returned
// an unrelated "Potato, french fries, with cheese" match live.
assertEqual(shouldSkipLiveEnrichment('smažený sýr (fried cheese)'), true, 'label with diacritics and gloss is skipped');

// A Czech label with diacritics but no parens.
assertEqual(shouldSkipLiveEnrichment('svíčková na smetaně'), true, 'label with diacritics is skipped');

// Czech dishes whose label carries no script/gloss signal at all — must be
// caught by the explicit set, not the pattern check.
assertEqual(shouldSkipLiveEnrichment('pork goulash'), true, 'explicitly-listed Czech dish label is skipped');
assertEqual(shouldSkipLiveEnrichment('utopenci'), true, 'explicitly-listed Czech dish label is skipped');

// Genuinely international/generic labels must NOT be skipped, even though
// some of their curated display names (e.g. banana -> "Banán") are in
// Czech. USDA has real, accurate coverage for these (verified live).
assertEqual(shouldSkipLiveEnrichment('banana'), false, 'plain international label is not skipped');
assertEqual(shouldSkipLiveEnrichment('pizza'), false, 'plain international label is not skipped');

// --- isConfident: softmax scores, best-first. Top-1 must clear 0.3 AND
// beat the runner-up by a 0.2 margin or a 2x ratio.

// Clear winner: high absolute score and a huge margin.
assertEqual(isConfident([0.5, 0.05, 0.03, 0.01]), true, 'decisive top-1 score is confident');

// Same top-1 score but a strong runner-up: margin 0.15 < 0.2 and ratio
// 1.43 < 2 — the photo genuinely sits between two labels, refuse the pick.
assertEqual(isConfident([0.5, 0.35, 0.1, 0.05]), false, 'close runner-up is not confident');

// Clears the margin but not the absolute floor (0.31 vs 0.02 would pass
// on ratio; 0.29 must fail regardless).
assertEqual(isConfident([0.29, 0.02, 0.01]), false, 'below MIN_PROBABILITY is never confident');

// Ratio path: margin alone is short (0.19 < 0.2) but top-1 is over 2x
// the runner-up — still a decisive win.
assertEqual(isConfident([0.40, 0.19, 0.1]), true, 'ratio >= 2 compensates a margin just under the threshold');

// Degenere inputs must not throw or hallucinate confidence.
assertEqual(isConfident([]), false, 'empty scores are not confident');
assertEqual(isConfident([0.9]), true, 'single score above threshold is confident');

// --- foldTemplates: (labels × templates) × dims -> labels × dims,
// rows averaged per label, then re-normalized to unit L2 norm so the
// dot-product scoring loop keeps working on unit vectors.
{
  const folded = foldTemplates(
    [
      [0.6, 0.8], // label A, template 1 (unit)
      [0.8, 0.6], // label A, template 2 (unit)
      [1, 0], // label B, template 1
      [0, 1], // label B, template 2
    ],
    2, // labels
    2, // templates
  );
  // Label A regularizes to the diagonal, exactly halfway between its two
  // template directions.
  assertApproxArray(folded[0], [Math.SQRT1_2, Math.SQRT1_2], 'averaged templates renormalize to the mean direction');
  // Label B: equal mix of axis vectors -> same diagonal, and both rows
  // are unit length.
  const norms = folded.map((row) => Math.hypot(...row));
  assertApproxArray(norms, [1, 1], 'folded rows are renormalized to unit L2 length');
}

{
  // One template per label folds to a no-op (already unit-normalized).
  const folded = foldTemplates([[0.6, 0.8]], 1, 1);
  assertApproxArray(folded[0], [0.6, 0.8], 'single template per label round-trips');
}

console.log('foodClassifier.check.ts: all checks passed');
