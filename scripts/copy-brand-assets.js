#!/usr/bin/env node
/**
 * Copies brand assets from shared/brand/ into each app's asset directory.
 *
 * Destinations:
 *   apps/retailer-portal/public/brand/   — all files
 *   apps/admin/public/brand/             — all files
 *   apps/mobile/assets/images/           — PNG files only
 *
 * Usage: node scripts/copy-brand-assets.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC  = path.join(ROOT, 'shared', 'brand');

const WEB_DESTINATIONS = [
  path.join(ROOT, 'apps', 'retailer-portal', 'public', 'brand'),
  path.join(ROOT, 'apps', 'admin', 'public', 'brand'),
];

const FLUTTER_DESTINATION = path.join(ROOT, 'apps', 'mobile', 'assets', 'images');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dest) {
  fs.copyFileSync(src, dest);
  console.log(`  copied → ${path.relative(ROOT, dest)}`);
}

function run() {
  if (!fs.existsSync(SRC)) {
    console.error(`Source directory not found: ${SRC}`);
    process.exit(1);
  }

  const files = fs.readdirSync(SRC).filter((f) => {
    // Skip README and hidden files
    return !f.startsWith('.') && f !== 'README.md';
  });

  if (files.length === 0) {
    console.warn('No asset files found in shared/brand/ — nothing to copy.');
    return;
  }

  // ── Web destinations (all files) ──────────────────────────────────────────
  for (const dest of WEB_DESTINATIONS) {
    ensureDir(dest);
    console.log(`\nCopying to ${path.relative(ROOT, dest)}/`);
    for (const file of files) {
      copyFile(path.join(SRC, file), path.join(dest, file));
    }
  }

  // ── Flutter destination (PNG only) ────────────────────────────────────────
  const pngFiles = files.filter((f) => f.toLowerCase().endsWith('.png'));
  if (pngFiles.length > 0) {
    ensureDir(FLUTTER_DESTINATION);
    console.log(`\nCopying PNG assets to ${path.relative(ROOT, FLUTTER_DESTINATION)}/`);
    for (const file of pngFiles) {
      copyFile(path.join(SRC, file), path.join(FLUTTER_DESTINATION, file));
    }
  } else {
    console.warn('\nNo PNG files found — Flutter assets not updated.');
  }

  console.log('\nDone.');
}

run();
