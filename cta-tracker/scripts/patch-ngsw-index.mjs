// Post-build: point the NGSW navigation-fallback index at the prerendered shell.
//
// In prerender/static mode Angular's application builder hard-codes the service-worker
// `index` to `index.csr.html` (the bare CSR shell) and ignores `index` in ngsw-config.json
// — see node_modules/@angular/build/src/utils/service-worker.js (`config.index = indexHtml`).
// That means an installed PWA, once NGSW controls it, would render the blank CSR shell on
// every launch, defeating TODO 8's startup-flicker goal.
//
// `ngsw-config.json` scopes `navigationUrls` to ["/"] so the SW only serves its index for the
// PWA's start_url ('/'); all sub-routes bypass the SW to the network (Firebase rewrite →
// /index.csr.html). Here we flip the index to the already-precached prerendered `/index.html`,
// so '/' is served the real shell cache-first (instant, online + offline) and hydrates cleanly
// (it matches the '' route). Sub-route document loads are unaffected (they bypass the SW).
import { readFileSync, writeFileSync } from 'node:fs';

const NGSW_PATH = 'dist/cta-tracker/browser/ngsw.json';
const PRERENDERED_INDEX = '/index.html';

const ngsw = JSON.parse(readFileSync(NGSW_PATH, 'utf8'));

if (!ngsw.hashTable || !(PRERENDERED_INDEX in ngsw.hashTable)) {
  throw new Error(
    `patch-ngsw-index: ${PRERENDERED_INDEX} is not precached in ${NGSW_PATH}; ` +
      `aborting so the SW navigation fallback is never left pointing at a missing asset.`
  );
}

if (ngsw.index === PRERENDERED_INDEX) {
  console.log(`patch-ngsw-index: index already ${PRERENDERED_INDEX}, nothing to do.`);
} else {
  const previous = ngsw.index;
  ngsw.index = PRERENDERED_INDEX;
  writeFileSync(NGSW_PATH, JSON.stringify(ngsw, null, 2));
  console.log(`patch-ngsw-index: index ${previous} -> ${PRERENDERED_INDEX}`);
}
