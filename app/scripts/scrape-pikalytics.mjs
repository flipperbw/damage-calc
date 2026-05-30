// One-shot scraper for Pikalytics's Champions data. Pulls two endpoints,
// transforms them into the app's data shapes, and writes five generated
// .ts files under app/src/data/generated/. Re-run monthly when a new
// Pikalytics period drops:
//
//   npm run scrape:pikalytics                # auto-pick most recent period
//   npm run scrape:pikalytics -- --period 2026-04
//   npm run scrape:pikalytics -- --no-fetch  # reuse raw-cache.json, only re-emit
//
// Source endpoints:
//   GET /api/l/<period>/<format>             — usage leaderboard; ~273 species
//                                              with surface fields (name,
//                                              percent, winPercent, types).
//                                              Full data only for rank 1; all
//                                              others are summary-only.
//   GET /api/p/<period>/<format>/<species>   — full per-species blob (items,
//                                              abilities, moves, spreads,
//                                              top-20 team sheets).
//                                              Pulled for every species we
//                                              want builds for (top BUILDS_LIMIT
//                                              by usage, ∪ landingTeams species).
//   GET /api/topteams/championstournaments   — global top-team list + 2/3/4-mon
//                                              cores.
//
// Period fallback: starts from currentMonth - 1, decrements until an endpoint
// returns a non-empty payload. Hard stops at 2026-04 (the earliest Champions
// period). Bail if all periods 404 / return empty.

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW_CACHE_PATH = path.resolve(__dirname, 'pikalytics-raw-cache.json');
const OUT_DIR = path.resolve(__dirname, '..', 'src', 'data', 'generated');

const FORMAT_SLUG = 'gen9championsvgc2026regma-1760';
const EARLIEST_PERIOD = '2026-04'; // hard floor — Champions launched here

// Variant clustering tuning
const VARIANT_USAGE_THRESHOLD = 0.15; // ≥15 % of that species's sheets
const MAX_VARIANTS_PER_SPECIES = 3;
const MIN_VARIANTS_PER_SPECIES = 1; // always emit at least one if any sheets exist

const TOP_THREATS_COUNT = 40;
const TOP_POOL_COUNT = 60;
const PRESET_TEAMS_COUNT = 20;

// Per-species fetches are the bulk of the runtime. We pull /api/p for the top
// BUILDS_LIMIT species by usage (covers every species an opponent is realistic-
// ally likely to bring), unioned with whatever appears on top-team landingTeams
// (so preset team mons can get a real modal nature/SPs). Off-meta species
// (rank > BUILDS_LIMIT) fall back to SM/USUM → synth in the dropdown.
const BUILDS_LIMIT = 150;
const FETCH_CONCURRENCY = 6;

// ───────────────────────────────────────────────────────────────────────────
// Period helpers

function previousMonth(period) {
  const [y, m] = period.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1)); // m-2 because Date months are 0-based
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function currentMonthMinusOne() {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// ───────────────────────────────────────────────────────────────────────────
// Fetching

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      accept: 'application/json',
      'user-agent': 'futuresight-scrape/1.0 (https://futuresight.gg)',
      'x-requested-with': 'XMLHttpRequest',
    },
  });
  if (!res.ok) {
    return { ok: false, status: res.status, body: null };
  }
  const text = await res.text();
  if (!text || text.trim().length === 0) {
    return { ok: false, status: 204, body: null };
  }
  try {
    const body = JSON.parse(text);
    return { ok: true, status: 200, body };
  } catch {
    return { ok: false, status: 0, body: null };
  }
}

async function fetchLeaderboardWithFallback(initialPeriod) {
  let period = initialPeriod;
  const tried = [];
  for (;;) {
    tried.push(period);
    const url = `https://www.pikalytics.com/api/l/${period}/${FORMAT_SLUG}`;
    console.log(`fetching ${url}`);
    const { ok, status, body } = await fetchJson(url);
    if (ok && Array.isArray(body) && body.length > 0) {
      return { period, body };
    }
    console.log(`  → ${ok ? 'empty body' : `status ${status}`}; trying previous month`);
    if (period === EARLIEST_PERIOD) {
      throw new Error(
        `Pikalytics leaderboard returned no usable data for any period tried: ${tried.join(', ')}`,
      );
    }
    period = previousMonth(period);
  }
}

// Pikalytics's species slug = lowercase the canonical name but PRESERVE
// hyphens. Stripping hyphens works for some single-word formes (Floette-Mega
// → floettemega) but breaks compound formes (Charizard-Mega-Y → 204).
// charizard-mega-y is what the live page hits and what /pokedex/<slug>
// resolves to.
function speciesSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9-]/g, '');
}

async function fetchPerSpeciesBatch(period, speciesNames) {
  // Bounded concurrency, polite to the origin.
  const queue = speciesNames.slice();
  const out = new Map();
  const failures = [];
  let done = 0;
  const total = queue.length;

  async function worker(id) {
    while (queue.length > 0) {
      const name = queue.shift();
      if (!name) return;
      const slug = speciesSlug(name);
      const url = `https://www.pikalytics.com/api/p/${period}/${FORMAT_SLUG}/${slug}`;
      const { ok, status, body } = await fetchJson(url);
      done += 1;
      if (!ok || !body || !Array.isArray(body.teams) || body.teams.length === 0) {
        failures.push({ name, status: ok ? 'empty' : status });
      } else {
        out.set(name, body);
      }
      if (done % 25 === 0 || done === total) {
        console.log(`  per-species: ${done}/${total} (worker ${id})`);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(FETCH_CONCURRENCY, total) }, (_, i) => worker(i + 1)),
  );

  if (failures.length > 0) {
    console.log(
      `  ${failures.length} species returned no data: ${failures
        .slice(0, 10)
        .map((f) => `${f.name}(${f.status})`)
        .join(', ')}${failures.length > 10 ? '…' : ''}`,
    );
  }
  return out;
}

async function fetchTopTeams() {
  const url = 'https://www.pikalytics.com/api/topteams/championstournaments';
  console.log(`fetching ${url}`);
  const { ok, status, body } = await fetchJson(url);
  if (!ok) {
    throw new Error(`Pikalytics topteams returned status ${status}`);
  }
  return body;
}

// ───────────────────────────────────────────────────────────────────────────
// Transforms

const STAT_KEYS_ORDER = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

// Pikalytics models mega formes as separate species ("Charizard-Mega-Y").
// Our SavedMon model has `species + mega + item`, so we split. The item names
// follow the standard ".+ite/.+nite" pattern with a handful of Champions
// exclusives we hard-code.
// Only species whose mega stone deviates from the standard "<base>ite" pattern
// (e.g. Audino → Audinite, not "Audinoite"). All other megas fall through to
// the standard suffix in normalizeForm.
const MEGA_ITEM_OVERRIDES = {
  Charizard: { 'mega-x': 'Charizardite X', 'mega-y': 'Charizardite Y' },
  Mewtwo: { 'mega-x': 'Mewtwonite X', 'mega-y': 'Mewtwonite Y' },
  Floette: { mega: 'Floettite' },           // base in our model is Floette-Eternal
  Dragonite: { mega: 'Dragoninite' },
  Skarmory: { mega: 'Skarmorite' },         // standard pattern would give "Skarmoryite"
  Sableye: { mega: 'Sablenite' },
  Slowbro: { mega: 'Slowbronite' },
  Heracross: { mega: 'Heracronite' },
  Houndoom: { mega: 'Houndoominite' },
  Glalie: { mega: 'Glalitite' },
  Diancie: { mega: 'Diancite' },
  Abomasnow: { mega: 'Abomasite' },
  Audino: { mega: 'Audinite' },
};

// Calc gen-0 keys some in-battle-forme species off their canonical *resting*
// forme name rather than the bare species name. Pikalytics uses the bare
// name ("Aegislash" rather than "Aegislash-Shield"), so we map at scrape
// time — otherwise calc's species lookup returns undefined and the entry
// gets dropped on app load.
const CALC_SPECIES_OVERRIDES = {
  Aegislash: 'Aegislash-Shield',
};

function canonicalSpecies(name) {
  return CALC_SPECIES_OVERRIDES[name] ?? name;
}

// Map Pikalytics's "Foo-Mega"/"Foo-Mega-X"/"Foo-Mega-Y" → our SavedMon
// shape. For non-mega names, returns species as-is. Floette is the one
// odd duck — its Mega is actually Floette-Eternal's evolution; our app
// keys it off "Floette-Eternal".
function normalizeForm(name) {
  const tail = name.match(/-Mega(?:-(X|Y))?$/);
  if (!tail) return { species: canonicalSpecies(name), mega: '', item: undefined };
  const base = name.slice(0, -tail[0].length);
  const variant = tail[1] ? `mega-${tail[1].toLowerCase()}` : 'mega';
  const species = base === 'Floette' ? 'Floette-Eternal' : canonicalSpecies(base);
  const override = MEGA_ITEM_OVERRIDES[base]?.[variant];
  // Standard pattern fallback: "<Base>ite" (e.g. Venusaur → Venusaurite,
  // Gardevoir → Gardevoirite). The override map covers the irregular ones.
  const item = override ?? `${base}ite`;
  return { species, mega: variant, item };
}

function parseSpSpread(evString) {
  // "2/32/0/0/0/32" → { hp: 2, atk: 32, spe: 32 } (zeros dropped)
  const parts = (evString ?? '').split('/').map((n) => Number(n) || 0);
  const out = {};
  for (let i = 0; i < STAT_KEYS_ORDER.length; i++) {
    const v = parts[i] ?? 0;
    if (v > 0) out[STAT_KEYS_ORDER[i]] = Math.min(32, v);
  }
  return out;
}

// Pikalytics returns moves with whitespace+capitalization variants ("Will-O-Wisp"
// fine; "Calm Mind " sometimes has trailing space). Normalize for clustering;
// keep original display for emit.
function cleanMove(name) {
  return (name ?? '').trim();
}

function pickModal(entries, keyFn) {
  // entries: array; returns the keyFn value with the highest count, ties broken
  // by first-seen order.
  if (entries.length === 0) return null;
  const counts = new Map();
  for (let i = 0; i < entries.length; i++) {
    const k = keyFn(entries[i]);
    if (k == null) continue;
    const prev = counts.get(k);
    counts.set(k, prev ? { count: prev.count + 1, firstAt: prev.firstAt } : { count: 1, firstAt: i });
  }
  let best = null;
  for (const [k, { count, firstAt }] of counts) {
    if (!best || count > best.count || (count === best.count && firstAt < best.firstAt)) {
      best = { key: k, count, firstAt };
    }
  }
  return best?.key ?? null;
}

// Pulls every sheet of `canonicalName` from a per-species `/api/p` payload.
// Each per-species entry carries `teams[20]` — the top-20 tournament teams
// featuring that species, with full per-mon sheets. That's our variant-
// clustering source. We pass in the canonical name explicitly because the
// per-species response's own top-level `.name` is sometimes the lowercase
// slug we requested (Sneasler → "sneasler") rather than the proper-cased
// form that appears in team.pokemon[].name.
function extractSheets(speciesEntry, canonicalName) {
  const sheets = [];
  for (const team of speciesEntry.teams ?? []) {
    for (const mon of team.pokemon ?? []) {
      if ((mon.name ?? '') === canonicalName) {
        sheets.push({
          item: mon.item ?? '',
          ability: mon.ability ?? '',
          moves: (mon.moves ?? []).map((m) => cleanMove(m.name)).filter(Boolean).slice(0, 4),
          // Tournament sheets carry no nature/EVs; fill in modal spread from
          // species's aggregate `spreads[]` later.
        });
      }
    }
  }
  return sheets;
}

function clusterByItem(sheets) {
  const buckets = new Map();
  for (const s of sheets) {
    if (!s.item) continue;
    if (!buckets.has(s.item)) buckets.set(s.item, []);
    buckets.get(s.item).push(s);
  }
  // Sort buckets by size desc.
  return [...buckets.entries()]
    .map(([item, items]) => ({ item, sheets: items, share: items.length / sheets.length }))
    .sort((a, b) => b.sheets.length - a.sheets.length);
}

const SETUP_MOVES = new Set([
  'dragon dance', 'swords dance', 'calm mind', 'nasty plot', 'bulk up',
  'quiver dance', 'shell smash', 'shift gear', 'tail glow', 'coil',
  'hone claws', 'geomancy', 'work up',
]);
const SUPPORT_MOVES = new Set([
  'fake out', 'tailwind', 'trick room', 'follow me', 'rage powder',
  'helping hand', 'parting shot', 'will-o-wisp', 'thunder wave', 'encore',
  'taunt', 'protect',
]);

// Role inference returns a single noun phrase WITHOUT mentioning the item — the
// caller prepends `itemShortName(item)`. Keeps names like "Sitrus Pivot" /
// "Band Wallbreaker" / "Scarf Sweeper" tight and consistent.
function inferRole({ item, modalSps, modalMoves }) {
  const itemLc = item.toLowerCase();
  const atk = modalSps.atk ?? 0;
  const spa = modalSps.spa ?? 0;
  const spe = modalSps.spe ?? 0;
  const hp = modalSps.hp ?? 0;
  const def = modalSps.def ?? 0;
  const spd = modalSps.spd ?? 0;
  const movesLc = modalMoves.map((m) => m.toLowerCase());
  const hasSetup = movesLc.some((m) => SETUP_MOVES.has(m));
  const supportCount = movesLc.filter((m) => SUPPORT_MOVES.has(m)).length;
  const isFast = spe >= 28;
  const phys = atk >= 28;
  const spec = spa >= 28;
  const bulky = hp >= 24 && def + spd >= 24;

  // Item-driven roles. Choice items and Assault Vest are item-typed enough that
  // the role expresses the playstyle the item locks you into.
  if (itemLc.startsWith('choice band')) return 'Wallbreaker';
  if (itemLc.startsWith('choice specs')) return 'Wallbreaker';
  if (itemLc.startsWith('choice scarf')) return 'Sweeper';
  if (itemLc === 'assault vest') return 'Tank';
  if (itemLc === 'rocky helmet') return 'Wall';
  if (itemLc === 'focus sash') return supportCount >= 2 ? 'Lead' : 'Sweeper';
  if (itemLc === 'weakness policy') return 'Sweeper';

  // Setup-move presence dominates the label when paired with a single-use item.
  if (hasSetup && (itemLc === 'white herb' || itemLc === 'leftovers' || itemLc.endsWith(' berry'))) {
    return 'Setup';
  }

  // Spread + moves heuristics.
  if (supportCount >= 2 && bulky) return 'Pivot';
  if (phys && isFast) return 'Sweeper';
  if (spec && isFast) return 'Sweeper';
  if (phys) return 'Attacker';
  if (spec) return 'Attacker';
  if (hp >= 28 && (def >= 16 || spd >= 16)) return def >= spd ? 'Tank' : 'Sp Tank';
  if (bulky) return 'Pivot';
  return 'Attacker';
}

// Pick the modal spread *for this species* (cluster ignores spread — sheets
// don't carry it). Use the species's aggregate spreads[0]. If absent, default
// to Hardy / empty.
function modalSpread(speciesEntry) {
  const top = (speciesEntry.spreads ?? [])[0];
  if (!top) return { nature: 'Hardy', sps: {} };
  return { nature: top.nature || 'Hardy', sps: parseSpSpread(top.ev) };
}

// Friendly suffix for mega variants when we merge them under the base species.
// Empty string for non-mega = no suffix.
function megaSuffix(mega) {
  if (mega === 'mega-x') return ' · Mega X';
  if (mega === 'mega-y') return ' · Mega Y';
  if (mega === 'mega') return ' · Mega';
  return '';
}

function transformBuilds(perSpecies) {
  // bySpecies: base species name → ordered list of variants. We group "Charizard",
  // "Charizard-Mega-X", and "Charizard-Mega-Y" under "Charizard" so the dropdown
  // surfaces every meta build the user might pick for that mon, regardless of
  // current mega state. Each variant carries its own mega flag so applying it
  // also flips the mon's mega state correctly.
  const bySpecies = new Map();
  for (const [canonicalName, sp] of perSpecies) {
    const sheets = extractSheets(sp, canonicalName);
    if (sheets.length === 0) continue;
    const norm = normalizeForm(canonicalName);
    const buckets = clusterByItem(sheets);
    const passing = buckets.filter((b) => b.share >= VARIANT_USAGE_THRESHOLD);
    // Always emit at least the top bucket (even if below threshold) so popular
    // species don't disappear from the picker just because their sheets are
    // very fragmented across items.
    const picked = (passing.length >= MIN_VARIANTS_PER_SPECIES ? passing : buckets.slice(0, MIN_VARIANTS_PER_SPECIES))
      .slice(0, MAX_VARIANTS_PER_SPECIES);

    const speciesSpread = modalSpread(sp);
    const variants = picked.map(({ item, sheets: bucket, share }) => {
      const modalAbility = pickModal(bucket, (s) => s.ability) ?? (sp.abilities?.[0]?.ability ?? '');
      // Top 4 moves by frequency within the bucket. Tied moves keep first-seen
      // order, which mirrors the cluster's original tournament-sheet ordering.
      const moveCounts = new Map();
      for (const s of bucket) {
        for (const m of s.moves) {
          if (!m) continue;
          moveCounts.set(m, (moveCounts.get(m) ?? 0) + 1);
        }
      }
      const topMoves = [...moveCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([m]) => m);
      while (topMoves.length < 4) topMoves.push('');

      const role = inferRole({
        item,
        modalSps: speciesSpread.sps,
        modalMoves: topMoves,
      });
      // For mega variants, the item is the mega stone (Charizardite Y etc.)
      // which would just restate the suffix — skip the item prefix and let
      // " · Mega Y" carry the identity. Base-forme variants keep the item
      // prefix because it's the only signal of the build's playstyle.
      const name = norm.mega
        ? `${role}${megaSuffix(norm.mega)}`
        : `${itemShortName(item)} ${role}`;

      return {
        name,
        item,
        ability: modalAbility,
        nature: speciesSpread.nature,
        sps: speciesSpread.sps,
        moves: [topMoves[0] ?? '', topMoves[1] ?? '', topMoves[2] ?? '', topMoves[3] ?? ''],
        mega: norm.mega,
        usageInBucket: Math.round(share * 1000) / 10,
      };
    });

    // Dedupe variants by name (in case two item buckets map to the same role
    // label, e.g. Soft Sand + Charcoal both "Physical Attacker"). Keep the
    // higher-usage one.
    const byName = new Map();
    for (const v of variants) {
      if (!byName.has(v.name) || byName.get(v.name).usageInBucket < v.usageInBucket) {
        byName.set(v.name, v);
      }
    }

    const base = norm.species;
    if (!bySpecies.has(base)) bySpecies.set(base, []);
    bySpecies.get(base).push(...byName.values());
  }
  // Final pass: sort variants within each species so non-mega variants land
  // before mega ones (and higher usage first within each group) — that's the
  // natural reading order in the dropdown.
  const out = [];
  for (const [species, variants] of bySpecies) {
    variants.sort((a, b) => {
      const ag = a.mega ? 1 : 0;
      const bg = b.mega ? 1 : 0;
      if (ag !== bg) return ag - bg;
      return b.usageInBucket - a.usageInBucket;
    });
    out.push({ species, variants });
  }
  return out;
}

function itemShortName(item) {
  // Shorten common multi-word items so the dropdown row stays compact.
  const map = {
    'Choice Band': 'Band',
    'Choice Scarf': 'Scarf',
    'Choice Specs': 'Specs',
    'Assault Vest': 'AV',
    'Focus Sash': 'Sash',
    'Rocky Helmet': 'Helmet',
    'Weakness Policy': 'Policy',
    'Expert Belt': 'E-Belt',
    'Safety Goggles': 'Goggles',
    'Covert Cloak': 'Cloak',
    'Eject Pack': 'Eject',
    'Eject Button': 'Eject Btn',
    'Mental Herb': 'Mental',
    'Mirror Herb': 'Mirror',
  };
  if (map[item]) return map[item];
  // Berries → drop the trailing " Berry": "Sitrus Berry" → "Sitrus",
  // "Roseli Berry" → "Roseli", "Chople Berry" → "Chople".
  if (item.endsWith(' Berry')) return item.slice(0, -' Berry'.length);
  return item;
}

function transformThreats(leaderboard) {
  return leaderboard
    .slice()
    .sort((a, b) => parseFloat(b.percent) - parseFloat(a.percent))
    .slice(0, TOP_THREATS_COUNT)
    .map((sp, i) => ({
      species: canonicalSpecies(sp.name),
      usagePercent: parseFloat(sp.percent),
      winRate: parseFloat(sp.winPercent ?? '0'),
      rank: i + 1,
    }));
}

function transformPool(leaderboard) {
  return leaderboard
    .slice()
    .sort((a, b) => parseFloat(b.percent) - parseFloat(a.percent))
    .slice(0, TOP_POOL_COUNT)
    .map((sp) => ({
      species: canonicalSpecies(sp.name),
      types: sp.types ?? [],
      usagePercent: parseFloat(sp.percent),
    }));
}

function transformPresets(topteams, perSpecies) {
  // Build a quick lookup: species → modal spread so we can fill nature/SPs on
  // tournament-team mons (which carry only item/ability/moves).
  const spreadByName = new Map();
  for (const [name, sp] of perSpecies) {
    spreadByName.set(name, modalSpread(sp));
  }

  const teams = (topteams.landingTeams ?? []).slice(0, PRESET_TEAMS_COUNT);
  return teams.map((t) => ({
    name: `${shortenEvent(t.tournamentLabel)} – ${t.author} ${t.record}`,
    blurb: `${t.author} (${t.record}) at ${shortenEvent(t.tournamentLabel)}`,
    author: t.author ?? '',
    record: t.record ?? '',
    tournamentDate: t.tournamentDate ?? '',
    mons: (t.pokemon ?? []).map((m) => {
      // Pikalytics models Charizard-Mega-Y as a separate species; our SavedMon
      // uses base species + mega flag + mega-stone item, matching the existing
      // hand-curated preset-teams.ts shape. The Pikalytics-provided item is
      // already the right mega stone, so keep it; only normalize species/mega.
      const norm = normalizeForm(m.name);
      const spread = spreadByName.get(m.name) ?? { nature: 'Hardy', sps: {} };
      return {
        species: norm.species,
        item: m.item || norm.item || undefined,
        ability: m.ability || undefined,
        nature: spread.nature,
        sps: spread.sps,
        moves: padMoves((m.moves ?? []).map((mm) => cleanMove(mm.name))),
        mega: norm.mega,
        boosts: {},
      };
    }),
  }));
}

function shortenEvent(label) {
  // "Maddo's Cup #8 | 100€ for the Winner | Reg M-A" → "Maddo's Cup #8".
  // Strip leading/trailing markdown emphasis chars (some tournament labels
  // come through as "*Sitrus-Series*") so they don't leak into the UI.
  return (label ?? '').split('|')[0].trim().replace(/^[*_~]+|[*_~]+$/g, '').trim();
}

function padMoves(moves) {
  const out = [moves[0] ?? '', moves[1] ?? '', moves[2] ?? '', moves[3] ?? ''];
  return out;
}

function transformCores(topteams) {
  const sizes = topteams.cores ?? {};
  const out = [];
  for (const sizeKey of ['2', '3', '4']) {
    const list = sizes[sizeKey] ?? [];
    for (const core of list) {
      out.push({
        size: Number(sizeKey),
        species: (core.pokemon ?? []).map((p) => p.name),
        usagePercent: parseFloat(core.usage),
        count: core.count ?? 0,
      });
    }
  }
  return out;
}

// ───────────────────────────────────────────────────────────────────────────
// Emit

function tsLiteral(v) {
  return JSON.stringify(v);
}

function header(period, fetchedAt) {
  return [
    '// @ts-nocheck',
    '// AUTO-GENERATED by app/scripts/scrape-pikalytics.mjs.',
    '// Do not hand-edit — re-run the script to refresh.',
    `// Source: https://www.pikalytics.com/api/l/${period}/${FORMAT_SLUG}`,
    `// Fetched: ${fetchedAt}`,
    '',
  ].join('\n');
}

function emitMeta({ period, fetchedAt, speciesCount }) {
  return [
    header(period, fetchedAt).replace('// @ts-nocheck\n', ''),
    'export const PIKALYTICS_META = {',
    `  period: ${tsLiteral(period)},`,
    `  format: ${tsLiteral(FORMAT_SLUG)},`,
    `  fetchedAt: ${tsLiteral(fetchedAt)},`,
    `  speciesCount: ${speciesCount},`,
    '} as const;',
    '',
  ].join('\n');
}

function emitBuilds(builds, period, fetchedAt) {
  return [
    header(period, fetchedAt).replace('// @ts-nocheck\n', ''),
    "import type { MegaState, StatID } from '@/types';",
    '',
    'export interface PikalyticsVariant {',
    '  /** Display name, e.g. "Sitrus Pivot" or "Sitrus Sweeper · Mega Y". */',
    '  name: string;',
    '  item: string;',
    '  ability: string;',
    '  nature: string;',
    '  sps: Partial<Record<StatID, number>>;',
    '  moves: [string, string, string, string];',
    "  /** Mega state implied by the variant (empty for the base forme). */",
    '  mega: MegaState;',
    '  /** % of the source forme\'s top-team sheets that ran this item. */',
    '  usageInBucket: number;',
    '}',
    '',
    'export interface PikalyticsBuild {',
    '  species: string;',
    '  variants: PikalyticsVariant[];',
    '}',
    '',
    `export const PIKALYTICS_BUILDS: PikalyticsBuild[] = ${tsLiteral(builds)};`,
    '',
  ].join('\n');
}

function emitThreats(threats, period, fetchedAt) {
  return [
    header(period, fetchedAt).replace('// @ts-nocheck\n', ''),
    'export interface PikalyticsThreat {',
    '  species: string;',
    '  usagePercent: number;',
    '  winRate: number;',
    '  rank: number;',
    '}',
    '',
    `export const PIKALYTICS_TOP_THREATS: PikalyticsThreat[] = ${tsLiteral(threats)};`,
    '',
  ].join('\n');
}

function emitPool(pool, period, fetchedAt) {
  return [
    header(period, fetchedAt).replace('// @ts-nocheck\n', ''),
    'export interface PikalyticsPoolEntry {',
    '  species: string;',
    '  types: readonly string[];',
    '  usagePercent: number;',
    '}',
    '',
    `export const PIKALYTICS_TOP_POOL: readonly PikalyticsPoolEntry[] = ${tsLiteral(pool)};`,
    '',
  ].join('\n');
}

function emitPresets(presets, period, fetchedAt) {
  return [
    header(period, fetchedAt).replace('// @ts-nocheck\n', ''),
    "import type { SavedMon } from '@/types';",
    '',
    'export interface PikalyticsPresetTeam {',
    '  name: string;',
    '  blurb: string;',
    '  author: string;',
    '  record: string;',
    '  tournamentDate: string;',
    "  mons: Omit<SavedMon, 'id'>[];",
    '}',
    '',
    `export const PIKALYTICS_PRESET_TEAMS: PikalyticsPresetTeam[] = ${tsLiteral(presets)};`,
    '',
  ].join('\n');
}

function emitCores(cores, period, fetchedAt) {
  return [
    header(period, fetchedAt).replace('// @ts-nocheck\n', ''),
    'export interface PikalyticsCore {',
    '  size: 2 | 3 | 4;',
    '  species: string[];',
    '  usagePercent: number;',
    '  count: number;',
    '}',
    '',
    `export const PIKALYTICS_CORES: PikalyticsCore[] = ${tsLiteral(cores)};`,
    '',
  ].join('\n');
}

// ───────────────────────────────────────────────────────────────────────────
// Main

async function main() {
  const argv = process.argv.slice(2);
  const periodArg = argIndex(argv, '--period');
  const noFetch = argv.includes('--no-fetch');

  let raw;
  if (noFetch) {
    console.log(`reusing raw cache at ${RAW_CACHE_PATH}`);
    const txt = await readFile(RAW_CACHE_PATH, 'utf8');
    raw = JSON.parse(txt);
  } else {
    const initialPeriod = periodArg ?? currentMonthMinusOne();
    const { period, body: leaderboard } = await fetchLeaderboardWithFallback(initialPeriod);
    const topteams = await fetchTopTeams();

    // Collect species needing /api/p:
    //   - top BUILDS_LIMIT by usage
    //   - every species appearing on a landing-team sheet (so presets fill
    //     nature/SPs from the modal spread we extract here)
    const byUsage = leaderboard
      .slice()
      .sort((a, b) => parseFloat(b.percent) - parseFloat(a.percent));
    const targetSet = new Set(byUsage.slice(0, BUILDS_LIMIT).map((sp) => sp.name));
    for (const t of topteams.landingTeams ?? []) {
      for (const m of t.pokemon ?? []) {
        if (m.name) targetSet.add(m.name);
      }
    }
    const targetNames = [...targetSet];
    console.log(`fetching /api/p for ${targetNames.length} species (concurrency ${FETCH_CONCURRENCY})`);
    const perSpeciesMap = await fetchPerSpeciesBatch(period, targetNames);
    const perSpecies = Object.fromEntries(perSpeciesMap);

    raw = {
      period,
      fetchedAt: new Date().toISOString(),
      leaderboard,
      topteams,
      perSpecies,
    };
    await writeFile(RAW_CACHE_PATH, JSON.stringify(raw, null, 2), 'utf8');
    console.log(
      `raw cache written: ${RAW_CACHE_PATH} (${raw.leaderboard.length} species in leaderboard, ${perSpeciesMap.size} fully fetched)`,
    );
  }

  const { period, fetchedAt, leaderboard, topteams, perSpecies } = raw;
  const perSpeciesMap = new Map(Object.entries(perSpecies ?? {}));
  console.log(
    `transforming: leaderboard ${leaderboard.length}, per-species ${perSpeciesMap.size}…`,
  );

  const builds = transformBuilds(perSpeciesMap);
  const threats = transformThreats(leaderboard);
  const pool = transformPool(leaderboard);
  const presets = transformPresets(topteams, perSpeciesMap);
  const cores = transformCores(topteams);

  console.log(
    `  builds: ${builds.length} species (${builds.reduce((a, b) => a + b.variants.length, 0)} variants)\n` +
      `  threats: ${threats.length}\n` +
      `  pool: ${pool.length}\n` +
      `  presets: ${presets.length}\n` +
      `  cores: ${cores.length}`,
  );

  await mkdir(OUT_DIR, { recursive: true });
  const speciesCount = leaderboard.length;
  await writeFile(path.join(OUT_DIR, 'pikalytics-meta.generated.ts'), emitMeta({ period, fetchedAt, speciesCount }), 'utf8');
  await writeFile(path.join(OUT_DIR, 'pikalytics-builds.generated.ts'), emitBuilds(builds, period, fetchedAt), 'utf8');
  await writeFile(path.join(OUT_DIR, 'pikalytics-threats.generated.ts'), emitThreats(threats, period, fetchedAt), 'utf8');
  await writeFile(path.join(OUT_DIR, 'pikalytics-pool.generated.ts'), emitPool(pool, period, fetchedAt), 'utf8');
  await writeFile(path.join(OUT_DIR, 'pikalytics-presets.generated.ts'), emitPresets(presets, period, fetchedAt), 'utf8');
  await writeFile(path.join(OUT_DIR, 'pikalytics-cores.generated.ts'), emitCores(cores, period, fetchedAt), 'utf8');

  console.log(`emitted 6 files to ${OUT_DIR}`);
}

function argIndex(argv, flag) {
  const i = argv.indexOf(flag);
  if (i < 0 || i + 1 >= argv.length) return undefined;
  return argv[i + 1];
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
