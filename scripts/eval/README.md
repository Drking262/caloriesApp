# Detection measurement harness (fix #12)

Thresholds in this repo (`AUTO_MATCH_THRESHOLD`, `MIN_PROBABILITY` / margin) were
calibrated once, by hand, on a handful of photos. This harness exists so they can
be tuned on **data** instead of anecdotes — and so a future change to the pipeline
shows up as a number going down, not as a support report.

## Dataset layout

Put real photos in a gitignored folder (dataset is personal + possibly large):

```
scripts/eval/data/<label>/<any-name>.jpg
scripts/eval/data/memory-same:spaghetti bolognese/bowl-angled.jpg
scripts/eval/data/memory-same:spaghetti bolognese/bowl-flat.jpg
scripts/eval/data/not-food:kitchen/table.jpg
```

`<label>` must be one of the CLIP labels — see the keys printed by:

```
node scripts/eval/index.ts --labels
```

Special labels that exercise specific layers (reported as their own rows):

- `memory-same:NAME` — "second shot of a meal already in memory": an entry is
  seeded into the synthetic memory under NAME with its OWN first photo's hash,
  and each photo is expected to hash-match it (tests camera-tilt / reframing
  robustness of `hashVariantsFromSource` + `rankMatches`).
- `memory-different:NAME` — photo of food that must NOT hash-match the seeded
  memory (tests false-auto-log: different meal, similar tableware/lighting).
- `not-food:<anything>` — tables, hands, cutlery, empty plates: the classifier
  must return null, and the pipeline must surface UNKNOWN rather than a guess.

## Run

```
npm run eval                                  # full report (no data → runs built-in self-test)
npm run eval -- --sweep                       # hash-threshold sweep across a synthetic corpus
node scripts/eval/index.ts --clip --data DIR  # also run the real CLIP model (downloads ~55MB once)
```

What it measures, per label and overall:

- `hash` layer: distance of each photo against its own seeded memory entry /
  against foreign entries — tells you exactly where `AUTO_ACCEPT_DISTANCE` /
  `AUTO_MATCH_THRESHOLD` sit relative to the same-vs-different distributions.
- `clip` layer (with `--clip`): top-1 accuracy, precision of "confident"
  predictions (high = silently-wrong-auto-logs are rare), unknown-rate on
  `not-food` (want ~100%).
- pipeline: which layer claimed each photo (auto / confirm-band / unknown) —
  the thing a user actually experiences.

Pure logic (hashing, ranking, relevance gating) runs offline and is
self-tested even with an empty dataset. CLIP needs network on first run only
(transformers.js caches under ~/.cache).

## A note on what the synthetic corpus proves (and doesn't)

With no `--data`, the harness runs on procedurally generated "plates". That
corpus is there to keep the harness runnable and to catch *regressions in the
matching code itself* — distance math, learning-band logic, ranking. Cartoon
plates deliberately share geometry (a disc on a table), so cross-dish overlap
on the synthetic set is expected and tells you almost nothing about real
food. **Don't tune `AUTO_ACCEPT_DISTANCE` / `AUTO_MATCH_THRESHOLD` from
synthetic numbers.** The numbers that matter are the ones the same code
produces on `scripts/eval/data/` — the synthetic row is a smoke test, the
real-data row is the instrument.
