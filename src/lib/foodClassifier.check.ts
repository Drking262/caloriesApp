import { shouldSkipLiveEnrichment } from './foodClassifier.ts';

function assertEqual(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`FAIL ${label}\n  actual:   ${a}\n  expected: ${e}`);
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

console.log('foodClassifier.check.ts: all checks passed');
