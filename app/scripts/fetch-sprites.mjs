// One-shot fetch script: pulls every dex sprite for the gen-0 species set
// into app/public/sprites/ so the runtime app never has to hit any remote
// origin. Re-running is idempotent — existing files are skipped. Run with
// `npm run fetch-sprites` from the app/ dir.
//
// Source order:
//   1. archives.bulbagarden.net — Bulbapedia "Menu CP" sprites are the
//      actual Pokémon Champions in-game menu icons (128×128). Filenames
//      are keyed by national dex number with an underscored forme suffix
//      (Menu_CP_0006-Mega_X.png). Direct image URLs are computable from
//      the MediaWiki convention md5(filename) → /upload/<h0>/<h0h1>/<name>.
//   2. PS dex/ — Smogon's 120×120 sprites. Used when Bulba doesn't have
//      the species/forme.
//   3. PS gen5/ — older 96×96 sprites for the rare species PS only hosts
//      under the gen5 tree (Volcarona's the live example).

import { createHash } from 'node:crypto';
import { writeFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Dex } from '@pkmn/dex';
import { Generations, MEGA_STONES } from '@smogon/calc';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '..', 'public', 'sprites');

// Mirror of app/src/data/sprites.ts spriteSlug — kept inline so this
// script doesn't import the TS source. The slug names the OUTPUT file
// regardless of which remote source we pull from.
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

const PS_PLACEHOLDER_SIZE = 3803;
const dex = Dex.forGen(9);

/**
 * Compute the Bulbapedia "Menu CP" filename for a Champions species. Returns
 * null when @pkmn/dex doesn't know the species (very rare — covers anything
 * gen-0 calc has but @pkmn/dex doesn't, mostly future-only species).
 */
function bulbaFilename(speciesName) {
  const sp = dex.species.get(speciesName);
  if (!sp || !sp.exists || !sp.num) return null;
  const numPadded = String(sp.num).padStart(4, '0');
  if (!sp.forme) return `Menu_CP_${numPadded}.png`;
  // Bulba uses underscores between forme tokens where @pkmn/dex uses hyphens
  // (Tauros-Paldea-Aqua's forme "Paldea-Aqua" → "Paldea_Aqua").
  const formeToken = sp.forme.replace(/-/g, '_');
  return `Menu_CP_${numPadded}-${formeToken}.png`;
}

function bulbaUrl(filename) {
  const h = createHash('md5').update(filename).digest('hex');
  return `https://archives.bulbagarden.net/media/upload/${h[0]}/${h[0]}${h[1]}/${filename}`;
}

async function tryBulba(speciesName) {
  const filename = bulbaFilename(speciesName);
  if (!filename) return null;
  const url = bulbaUrl(filename);
  const res = await fetch(url);
  if (res.status !== 200) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  return { buf, root: 'bulba', detail: filename };
}

const PS_FALLBACK_ROOTS = ['dex', 'gen5'];

async function tryPS(slug) {
  for (const root of PS_FALLBACK_ROOTS) {
    const url = `https://play.pokemonshowdown.com/sprites/${root}/${slug}.png`;
    const res = await fetch(url);
    if (res.status !== 200) continue;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === PS_PLACEHOLDER_SIZE) continue;
    return { buf, root: `ps/${root}`, detail: url };
  }
  return null;
}

async function fetchSprite(speciesName, slug) {
  const bulba = await tryBulba(speciesName);
  if (bulba) return bulba;
  const ps = await tryPS(slug);
  return ps;
}

const gen = Generations.get(0);
const targets = new Map(); // slug -> species name
for (const sp of gen.species) {
  targets.set(spriteSlug(sp.name), sp.name);
}
// Also include mega forme display names so the picker / editor can render
// them when mega is toggled. MEGA_STONES values like 'Charizard-Mega-X'.
for (const stone of Object.keys(MEGA_STONES)) {
  const entry = MEGA_STONES[stone];
  for (const formeName of Object.values(entry)) {
    if (!targets.has(spriteSlug(formeName))) {
      targets.set(spriteSlug(formeName), formeName);
    }
  }
}

await mkdir(OUT_DIR, { recursive: true });

const total = targets.size;
let downloaded = 0;
let skipped = 0;
let missing = 0;
const sourceCounts = { bulba: 0, 'ps/dex': 0, 'ps/gen5': 0 };
const fallbacks = []; // species that needed PS fallback (Bulba miss)

for (const [slug, name] of targets) {
  const target = path.join(OUT_DIR, `${slug}.png`);
  try {
    await access(target);
    skipped += 1;
    continue;
  } catch {
    // file doesn't exist — fetch it
  }
  try {
    const result = await fetchSprite(name, slug);
    if (!result) {
      missing += 1;
      console.warn(`[${slug}] missing — no sprite from any source (name="${name}")`);
      continue;
    }
    await writeFile(target, result.buf);
    sourceCounts[result.root] = (sourceCounts[result.root] ?? 0) + 1;
    if (result.root !== 'bulba') {
      fallbacks.push(`${slug} ← ${result.root} (Bulba missing: ${bulbaFilename(name) ?? 'no dex entry'})`);
    }
    downloaded += 1;
    if (downloaded % 25 === 0) {
      console.log(`progress: ${downloaded}/${total} downloaded, ${missing} missing`);
    }
  } catch (err) {
    console.warn(`[${slug}] fetch failed: ${err?.message ?? err}`);
    missing += 1;
  }
}

console.log('---');
console.log(`total slugs:    ${total}`);
console.log(`downloaded:     ${downloaded}`);
console.log(`already cached: ${skipped}`);
console.log(`missing:        ${missing}`);
console.log(`source counts:  bulba=${sourceCounts.bulba}, ps/dex=${sourceCounts['ps/dex']}, ps/gen5=${sourceCounts['ps/gen5']}`);
if (fallbacks.length) {
  console.log(`fallbacks (${fallbacks.length}):`);
  for (const f of fallbacks) console.log(`  - ${f}`);
}
console.log(`output dir:     ${OUT_DIR}`);
