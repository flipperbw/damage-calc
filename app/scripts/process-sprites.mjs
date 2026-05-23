// Post-process the bundled dex sprites: trim the surrounding transparent
// padding that PS bakes into the 120×120 canvas, then re-canvas each to
// a uniform 100×100 with the character centered. Padding becomes a CSS
// concern (the <Sprite> container can add `p-1`/`p-2` as desired), and
// no runtime CSS transform is needed to "zoom in" on the character.
//
// Run with: `npm run process-sprites` from the app/ dir.
// Idempotent — re-running on already-trimmed images is a no-op (trim
// finds nothing to remove).

import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(__dirname, '..', 'public', 'sprites');

// Target canvas size. PS dex sprites are 120×120. After trimming we shrink
// the trimmed bbox to fit inside this canvas, centered, with a small
// transparent border so the character isn't kissing the edge.
const CANVAS = 100;
const MARGIN = 4; // px on each side reserved as transparent border
const INNER = CANVAS - MARGIN * 2;

const files = (await readdir(DIR)).filter((f) => f.endsWith('.png'));
let processed = 0;
let bytesBefore = 0;
let bytesAfter = 0;
const failed = [];

for (const file of files) {
  const full = path.join(DIR, file);
  try {
    const input = await readFile(full);
    bytesBefore += input.length;
    const output = await sharp(input)
      // Trim transparent padding. PS sprites have alpha=0 at the corners,
      // so sharp picks transparent as the background to trim.
      .trim()
      // Fit the trimmed bbox into an INNER×INNER area, preserving aspect.
      // The longer dimension hits INNER; the shorter dimension is smaller.
      // Allow enlargement so every species ends up the same visual size in
      // the canvas; we compensate for the lanczos-resize blur with an
      // unsharp-mask pass below.
      .resize(INNER, INNER, { fit: 'inside' })
      // Pad up to a CANVAS×CANVAS square with transparent background,
      // centered. The character is now framed with at least MARGIN px of
      // breathing room on every side.
      .resize(CANVAS, CANVAS, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
        position: 'center',
      })
      // Unsharp mask to recover edge crispness lost in the resize. sigma
      // controls the blur radius the filter measures against; small mons
      // upscaled from a 50-px bbox benefit most, big mons get a milder
      // boost. m1/m2 control the boost per stop — these values match
      // sharp's "moderate sharpen" preset that keeps anti-aliased outlines
      // clean without overshooting into halos.
      .sharpen({ sigma: 0.8, m1: 0.4, m2: 1.4 })
      // Indexed palette PNG (matches PS's own encoding) is far smaller for
      // sprite-art with bounded colour counts than the default RGBA output.
      .png({ palette: true, compressionLevel: 9 })
      .toBuffer();
    bytesAfter += output.length;
    await writeFile(full, output);
    processed += 1;
    if (processed % 25 === 0) {
      console.log(`processed ${processed}/${files.length}…`);
    }
  } catch (err) {
    failed.push(file);
    console.warn(`[${file}] ${err?.message ?? err}`);
  }
}

const before = (bytesBefore / 1024 / 1024).toFixed(2);
const after = (bytesAfter / 1024 / 1024).toFixed(2);
console.log('---');
console.log(`processed:   ${processed}/${files.length}`);
console.log(`size before: ${before} MB`);
console.log(`size after:  ${after} MB`);
if (failed.length) {
  console.log(`failures:    ${failed.length}`);
  for (const f of failed) console.log(`  - ${f}`);
}
