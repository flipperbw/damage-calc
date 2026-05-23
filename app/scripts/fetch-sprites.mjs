// One-shot fetch script: pulls every PS dex sprite for the gen-0 species
// set into app/public/sprites/ so the runtime app never has to hit
// play.pokemonshowdown.com. Re-running is idempotent — existing files are
// skipped. Run with: `node scripts/fetch-sprites.mjs` from the app/ dir.

import { writeFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Generations, MEGA_STONES } from '@smogon/calc';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '..', 'public', 'sprites');

// Mirror of app/src/data/sprites.ts spriteSlug — kept inline so this
// script doesn't import the TS source. If the slug rules change in the
// app, update both.
const INTRINSIC_HYPHEN_NAMES = {
  'Kommo-o': 'kommoo',
  'Jangmo-o': 'jangmoo',
  'Hakamo-o': 'hakamoo',
  'Porygon-Z': 'porygonz',
  'Ho-Oh': 'hooh',
  'Mr. Mime': 'mrmime',
  'Mr. Rime': 'mrrime',
  'Mime Jr.': 'mimejr',
  'Type: Null': 'typenull',
};

function spriteSlug(species) {
  const intrinsic = INTRINSIC_HYPHEN_NAMES[species];
  if (intrinsic) return intrinsic;
  const lower = species.toLowerCase().replace(/[^a-z0-9-]/g, '');
  const idx = lower.indexOf('-');
  if (idx < 0) return lower;
  return lower.slice(0, idx + 1) + lower.slice(idx + 1).replace(/-/g, '');
}

// PS serves a 3803-byte transparent placeholder for unknown sprite slugs
// instead of a real 404. Guard against that so we don't end up with
// hundreds of identical placeholder PNGs on disk.
const PS_PLACEHOLDER_SIZE = 3803;

// Sprite roots to try in order. Some gen-5+ species (Volcarona is the live
// example) live only under `gen5/` even though they exist in dex; PS just
// doesn't host their dex sprite. After dex returns the placeholder, fall
// back to gen5 so we cover that gap.
const SPRITE_ROOTS = ['dex', 'gen5'];

async function fetchSprite(slug) {
  for (const root of SPRITE_ROOTS) {
    const url = `https://play.pokemonshowdown.com/sprites/${root}/${slug}.png`;
    const res = await fetch(url);
    if (res.status !== 200) continue;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === PS_PLACEHOLDER_SIZE) continue;
    return { buf, root };
  }
  return null;
}

const gen = Generations.get(0);
const slugs = new Set();
for (const sp of gen.species) {
  slugs.add(spriteSlug(sp.name));
}
// Also include mega forme names — calc's species table has them, but some
// callsites may pass the prefixed name directly. Cheap to include them too.
for (const stone of Object.keys(MEGA_STONES)) {
  const entry = MEGA_STONES[stone];
  for (const formeName of Object.values(entry)) {
    slugs.add(spriteSlug(formeName));
  }
}

await mkdir(OUT_DIR, { recursive: true });

const total = slugs.size;
let downloaded = 0;
let skipped = 0;
let placeholder = 0;
let httpFail = 0;
const fallbackUsed = [];

for (const slug of slugs) {
  const target = path.join(OUT_DIR, `${slug}.png`);
  try {
    await access(target);
    skipped += 1;
    continue;
  } catch {
    // file doesn't exist — fetch it
  }
  try {
    const result = await fetchSprite(slug);
    if (!result) {
      placeholder += 1;
      console.warn(`[${slug}] no sprite found in any root`);
      continue;
    }
    await writeFile(target, result.buf);
    if (result.root !== 'dex') fallbackUsed.push(`${slug} (${result.root})`);
    downloaded += 1;
    if (downloaded % 25 === 0) {
      console.log(`progress: downloaded=${downloaded}, skipped=${skipped}, placeholder=${placeholder}, fail=${httpFail}`);
    }
  } catch (err) {
    console.warn(`[${slug}] fetch failed: ${err?.message ?? err}`);
    httpFail += 1;
  }
}

console.log('---');
console.log(`total slugs:    ${total}`);
console.log(`downloaded:     ${downloaded}`);
console.log(`already cached: ${skipped}`);
console.log(`placeholder:    ${placeholder}`);
console.log(`http failures:  ${httpFail}`);
if (fallbackUsed.length) {
  console.log(`gen5 fallback:  ${fallbackUsed.length}`);
  for (const f of fallbackUsed) console.log(`  - ${f}`);
}
console.log(`output dir:     ${OUT_DIR}`);
