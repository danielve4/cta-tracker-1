// One-shot generator for iOS PWA launch screens (apple-touch-startup-image).
//
// iOS shows a launch image the instant a standalone (Add-to-Home-Screen) app
// process starts — before WebKit paints anything. Without these images the
// user stares at a blank screen for the whole cold-boot (~2 s on an evicted
// process). Run this script once, commit the PNGs it writes to
// src/assets/splash/, and paste the <link> block it prints into
// src/index.html. It is intentionally NOT part of `npm run build`: the
// assets only change when the icon or device matrix does, and CI stays
// browser-free.
//
// Usage:  node scripts/generate-ios-splash.mjs
// Env:    CHROME_BIN — path to a Chrome/Chromium binary (otherwise this
//         script globs /opt/pw-browsers/chromium-*/chrome-linux/chrome and
//         falls back to `chromium`/`google-chrome` on PATH).
//
// iOS matches images by exact CSS points + device-pixel-ratio + orientation,
// so every supported device class needs its own portrait and landscape PNG.
// It also snapshots the image at Add-to-Home-Screen time: existing installs
// must remove + re-add the app to pick up new art, and changed art must be
// written to NEW filenames (the hosting config serves /assets/** immutable).

import { execFileSync } from 'node:child_process';
import { globSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ICON = resolve('src/assets/icons/icon-512x512.png');
const OUT_DIR = resolve('src/assets/splash');
// Real page backgrounds from src/styles.css (--background), not the
// status-bar theme-color, so splash → first shell paint is seamless.
const THEMES = { dark: '#0a0a0c', light: '#f4f4f8' };

// device-width/-height are CSS points (portrait); px = pt * DPR.
// One row per distinct viewport class, iPhone 8/SE2 through the 17 line.
const DEVICES = [
  { pt: [375, 667], dpr: 2 }, // 8 / SE 2 / SE 3
  { pt: [414, 736], dpr: 3 }, // 8 Plus
  { pt: [375, 812], dpr: 3 }, // X / XS / 11 Pro / 12 mini / 13 mini
  { pt: [414, 896], dpr: 2 }, // XR / 11
  { pt: [414, 896], dpr: 3 }, // XS Max / 11 Pro Max
  { pt: [390, 844], dpr: 3 }, // 12 / 12 Pro / 13 / 13 Pro / 14
  { pt: [428, 926], dpr: 3 }, // 12 Pro Max / 13 Pro Max / 14 Plus
  { pt: [393, 852], dpr: 3 }, // 14 Pro / 15 / 15 Pro / 16 / 17
  { pt: [430, 932], dpr: 3 }, // 14 Pro Max / 15 Plus / 15 Pro Max / 16 Plus
  { pt: [402, 874], dpr: 3 }, // 16 Pro / 17 Pro
  { pt: [440, 956], dpr: 3 }, // 16 Pro Max / 17 Pro Max
  { pt: [420, 912], dpr: 3 }, // iPhone Air
];

function findChrome() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  const hit = globSync('/opt/pw-browsers/chromium-*/chrome-linux/chrome');
  if (hit.length) return hit[0];
  for (const bin of ['chromium', 'chromium-browser', 'google-chrome']) {
    try {
      execFileSync('which', [bin]);
      return bin;
    } catch {
      /* keep looking */
    }
  }
  throw new Error('No Chromium found; set CHROME_BIN.');
}

const chrome = findChrome();
const iconDataUri = `data:image/png;base64,${readFileSync(ICON).toString('base64')}`;
const work = join(tmpdir(), `ios-splash-${process.pid}`);
mkdirSync(work, { recursive: true });
mkdirSync(OUT_DIR, { recursive: true });

function shoot(width, height, bg, outFile) {
  const iconPx = Math.round(0.28 * Math.min(width, height));
  const page = join(work, 'splash.html');
  writeFileSync(
    page,
    `<!doctype html><meta charset="utf-8"><style>
      html,body{margin:0;width:100%;height:100%;background:${bg};
        display:flex;align-items:center;justify-content:center}
      img{width:${iconPx}px;height:${iconPx}px}
    </style><img src="${iconDataUri}">`
  );
  execFileSync(chrome, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    `--window-size=${width},${height}`,
    `--screenshot=${outFile}`,
    `--user-data-dir=${join(work, 'profile')}`,
    `file://${page}`,
  ]);
}

const links = [];
for (const [theme, bg] of Object.entries(THEMES)) {
  // Dark links carry no color-scheme clause so they always match (the app
  // defaults to dark and WebKit's prefers-color-scheme support in startup
  // image media queries is unreliable — failing "safe to dark" is correct).
  const scheme = theme === 'light' ? ' and (prefers-color-scheme: light)' : '';
  for (const { pt, dpr } of DEVICES) {
    const [wpt, hpt] = pt;
    for (const orientation of ['portrait', 'landscape']) {
      const [w, h] = orientation === 'portrait' ? [wpt * dpr, hpt * dpr] : [hpt * dpr, wpt * dpr];
      const name = `apple-splash-${theme}-${w}x${h}.png`;
      const out = join(OUT_DIR, name);
      shoot(w, h, bg, out);
      console.error(`wrote ${out}`);
      links.push(
        `  <link rel="apple-touch-startup-image"\n` +
          `        media="screen${scheme} and (device-width: ${wpt}px) and (device-height: ${hpt}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: ${orientation})"\n` +
          `        href="assets/splash/${name}">`
      );
    }
  }
}

rmSync(work, { recursive: true, force: true });
console.log('\nPaste into src/index.html after the manifest <link>:\n');
console.log(links.join('\n'));
