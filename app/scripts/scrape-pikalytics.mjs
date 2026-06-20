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
// returns a non-empty payload. Hard stops at EARLIEST_PERIOD. Bail if all
// periods 404 / return empty.

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW_CACHE_PATH = path.resolve(__dirname, 'pikalytics-raw-cache.json');
const OUT_DIR = path.resolve(__dirname, '..', 'src', 'data', 'generated');

// Regulation M-B (launched 2026-06; M-B ruleset was ladder-playable from
// ~2026-05, so Pikalytics's 2026-05 period already carries mature M-B usage).
const FORMAT_SLUG = 'gen9championsvgc2026regmb-1760';
const EARLIEST_PERIOD = '2026-05'; // hard floor — earliest populated M-B period

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
// Fetch /api/p for the whole leaderboard so every meta mon gets build profiles
// (not just the top slice). The leaderboard is ~210 species; this caps it
// generously while staying finite.
const BUILDS_LIMIT = 1000;
// Minimum aggregate item usage (%) for a non-stone item to become its own
// variant when a mon has no team sheets to cluster. Keeps fall-back variants to
// the items people actually run.
const ITEM_MIN_USAGE = 10; // percent
// A base species' item usage reveals which mega formes it runs (Charizardite Y,
// Raichunite X, …). We fetch those forme endpoints explicitly so mega coverage
// is deterministic instead of depending on which mons happened to land in the
// top-team snapshot. Mega stones get this lower bar (each stone is a distinct
// forme worth surfacing, e.g. Charizardite X at ~4%).
const MEGA_STONE_MIN_USAGE = 1; // percent
const FETCH_CONCURRENCY = 6;
// Retry genuine HTTP failures (network error / non-200) with backoff. A 200
// with an empty `teams` array is NOT a failure — that species just has no
// top-team sheets yet (common for mid-tier mons early in a regulation), so we
// accept it without retrying.
const PER_SPECIES_RETRIES = 3;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
      let body = null;
      let lastStatus = 'empty';
      for (let attempt = 0; attempt < PER_SPECIES_RETRIES; attempt += 1) {
        const res = await fetchJson(url);
        if (res.ok) {
          // 200 + valid JSON. A populated `teams` array gives us build
          // variants; a populated `spreads` array (even with no teams) is the
          // EV data we fetch base always-mega species for (Charizard etc. have
          // no team sheets of their own but carry the aggregate spread the mega
          // variants borrow). Keep the body if either is present; an empty one
          // is a legitimate "this mon has nothing" answer. Either way, stop.
          const hasTeams = Array.isArray(res.body?.teams) && res.body.teams.length > 0;
          const hasSpreads = Array.isArray(res.body?.spreads) && res.body.spreads.length > 0;
          if (hasTeams || hasSpreads) {
            body = res.body;
          }
          break;
        }
        // Genuine failure (network / non-200) — back off and retry.
        lastStatus = res.status;
        if (attempt < PER_SPECIES_RETRIES - 1) {
          await delay(500 * 2 ** attempt + Math.floor(Math.random() * 250));
        }
      }
      done += 1;
      if (body) {
        out.set(name, body);
      } else {
        failures.push({ name, status: lastStatus });
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

// Move the attacking EV investment onto the stat THIS forme actually uses.
// Mega-forme /api/p endpoints carry no spread under M-B, so we borrow the base
// species' aggregate spread — but that single modal can't tell Mega-X
// (physical) from Mega-Y (special). Compare the forme's own base Atk vs SpA
// (from its /api/p `stats`) and swap atk↔spa if the borrowed spread invested in
// the wrong one. Magnitude is preserved; only the side moves.
function remapAttackStat(sps, formeStats) {
  const atk = sps.atk ?? 0;
  const spa = sps.spa ?? 0;
  if (atk === 0 && spa === 0) return { ...sps };
  const formePhysical = (formeStats?.atk ?? 0) >= (formeStats?.spa ?? 0);
  const out = { ...sps };
  if (formePhysical && spa > atk) {
    out.atk = spa;
    delete out.spa;
  } else if (!formePhysical && atk > spa) {
    out.spa = atk;
    delete out.atk;
  }
  return out;
}

// Friendly suffix for mega variants when we merge them under the base species.
// Empty string for non-mega = no suffix.
function megaSuffix(mega) {
  if (mega === 'mega-x') return ' · Mega X';
  if (mega === 'mega-y') return ' · Mega Y';
  if (mega === 'mega') return ' · Mega';
  return '';
}

// Is this item a mega stone? Stones end in "ite", optionally with an " X"/" Y"
// forme suffix (Cameruptite, Raichunite Y, Sceptilite, Charizardite X). Stone
// spellings are irregular (Raichu→Raichunite, Sceptile→Sceptilite), so we
// detect by suffix rather than reconstructing the name. Eviolite is the one
// non-stone "ite" item.
function isMegaStoneItem(item) {
  return /ite( [XY])?$/.test(item ?? '') && item !== 'Eviolite';
}

// The mega forme a stone implies for a base species, by the REGULAR
// "{base}-Mega(-X/-Y)" pattern (which forme endpoints actually use), keyed off
// the base species + the stone's X/Y suffix — not the stone's own spelling.
function stoneFormeName(baseName, item) {
  if (!isMegaStoneItem(item)) return null;
  if (/ X$/.test(item)) return `${baseName}-Mega-X`;
  if (/ Y$/.test(item)) return `${baseName}-Mega-Y`;
  return `${baseName}-Mega`;
}

function formeToMegaState(forme) {
  if (/-Mega-X$/.test(forme)) return 'mega-x';
  if (/-Mega-Y$/.test(forme)) return 'mega-y';
  return 'mega';
}

// Top 4 moves from a blob's aggregate move usage. The fall-back when a mon has
// no team sheets of its own to cluster.
function aggMoves(entry) {
  const sorted = (entry?.moves ?? []).slice().sort((a, b) => parseFloat(b.percent) - parseFloat(a.percent));
  const out = sorted.map((m) => cleanMove(m.move ?? m.name)).filter(Boolean).slice(0, 4);
  while (out.length < 4) out.push('');
  return out;
}

function aggAbility(entry) {
  const sorted = (entry?.abilities ?? []).slice().sort((a, b) => parseFloat(b.percent) - parseFloat(a.percent));
  return sorted[0]?.ability ?? '';
}

// Top 4 moves by frequency within a clustered item bucket of team sheets.
function topMovesFromBucket(bucket) {
  const counts = new Map();
  for (const s of bucket) {
    for (const m of s.moves) {
      if (!m) continue;
      counts.set(m, (counts.get(m) ?? 0) + 1);
    }
  }
  const out = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([m]) => m);
  while (out.length < 4) out.push('');
  return out;
}

// Hybrid moves + ability for one (entry, item): prefer the entry's own team
// sheets running that item (set-accurate, item↔move correlated); fall back to
// the entry's aggregate usage when it has no sheets.
function movesAbilityFor(entry, entryName, item) {
  const sheets = extractSheets(entry, entryName);
  const bucket = sheets.filter((s) => s.item === item);
  if (bucket.length > 0) {
    return { moves: topMovesFromBucket(bucket), ability: pickModal(bucket, (s) => s.ability) ?? aggAbility(entry) };
  }
  return { moves: aggMoves(entry), ability: aggAbility(entry) };
}

function transformBuilds(perSpecies) {
  // One build line per base species. We iterate base species only; mega-forme
  // entries (Charizard-Mega-Y, …) are pulled in as a per-forme moves/stats
  // source for their base species's mega-stone items, not as their own line.
  //
  // A mon's variants come from its OWN usage:
  //   - team-sheet item buckets when it appears on top teams (set-accurate,
  //     item↔move correlated), else
  //   - aggregate item usage (so every mon with data gets profiles).
  // Mega-stone items attach the matching mega forme: moves from the forme's own
  // endpoint (hybrid), EV spread grafted from the base species (mega endpoints
  // ship none) and remapped to the forme's attack stat.
  const bySpecies = new Map();
  for (const [canonicalName, sp] of perSpecies) {
    if (/-Mega(?:-[XY])?$/.test(canonicalName)) continue; // moves/stats source only

    const baseSpread = modalSpread(sp);
    const sheets = extractSheets(sp, canonicalName);

    // Which items become variants for this mon.
    let itemCandidates;
    if (sheets.length > 0) {
      const buckets = clusterByItem(sheets);
      const passing = buckets.filter((b) => b.share >= VARIANT_USAGE_THRESHOLD);
      const picked = (passing.length >= MIN_VARIANTS_PER_SPECIES ? passing : buckets.slice(0, MIN_VARIANTS_PER_SPECIES))
        .slice(0, MAX_VARIANTS_PER_SPECIES);
      itemCandidates = picked.map((b) => ({ item: b.item, share: b.share }));
    } else {
      let agg = (sp.items ?? []).filter((it) => {
        const u = parseFloat(it.percent);
        if (!Number.isFinite(u)) return false;
        return u >= (isMegaStoneItem(it.item) ? MEGA_STONE_MIN_USAGE : ITEM_MIN_USAGE);
      });
      if (agg.length === 0 && (sp.items?.length ?? 0) > 0) agg = [sp.items[0]];
      itemCandidates = agg.slice(0, MAX_VARIANTS_PER_SPECIES).map((it) => ({ item: it.item, share: (parseFloat(it.percent) || 0) / 100 }));
    }
    if (itemCandidates.length === 0) continue;

    const variants = itemCandidates.map(({ item, share }) => {
      const forme = stoneFormeName(canonicalName, item);
      // Every mega stone marks a mega. Some megas have their own forme endpoint
      // (per-forme moves/stats — Charizard / Raichu X/Y); most M-B custom megas
      // keep all their data on the base page (empty forme endpoint), so we use
      // the base mon's data and just flip the mega flag.
      const megaEntry = forme ? perSpecies.get(forme) : null;
      const mega = forme ? formeToMegaState(forme) : '';
      const src = megaEntry ?? sp;
      const srcName = megaEntry ? forme : canonicalName;
      const { moves, ability } = movesAbilityFor(src, srcName, item);
      // EV spread: base aggregate, remapped to the forme's attack stat for megas
      // (the forme's stats when we have its endpoint, else the base mon's).
      const sps = mega ? remapAttackStat(baseSpread.sps, megaEntry?.stats ?? sp.stats) : baseSpread.sps;
      const role = inferRole({ item, modalSps: sps, modalMoves: moves });
      // Mega variants let " · Mega [X/Y]" carry the identity (the item is just
      // the stone); base variants prefix the item, the only playstyle signal.
      const name = mega ? `${role}${megaSuffix(mega)}` : `${itemShortName(item)} ${role}`;

      return {
        name,
        item,
        ability: ability || (sp.abilities?.[0]?.ability ?? ''),
        nature: baseSpread.nature,
        sps,
        moves: [moves[0] ?? '', moves[1] ?? '', moves[2] ?? '', moves[3] ?? ''],
        mega,
        usageInBucket: Math.round(share * 1000) / 10,
      };
    });

    // Dedupe variants by name (two items can map to the same role label). Keep
    // the higher-usage one.
    const byName = new Map();
    for (const v of variants) {
      if (!byName.has(v.name) || byName.get(v.name).usageInBucket < v.usageInBucket) {
        byName.set(v.name, v);
      }
    }

    const base = canonicalSpecies(canonicalName);
    if (!bySpecies.has(base)) bySpecies.set(base, []);
    bySpecies.get(base).push(...byName.values());
  }
  // Final pass: sort variants by usage, most-used first. The first variant is
  // both the dropdown's top row AND the auto-selected default when an opponent
  // is picked, so it must be the mon's most common set — including its mega if
  // that's how it's usually run (e.g. Raichu/Charizard are mostly mega, so the
  // mega set leads, not a rare base set).
  const out = [];
  for (const [species, variants] of bySpecies) {
    variants.sort((a, b) => b.usageInBucket - a.usageInBucket);
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

// Per-species usage as a finite percentage. Pikalytics changed the leaderboard
// schema between regulations: M-A exposed a top-level `percent` (% of teams),
// M-B dropped it for raw `games` counts. Fall back to each species' share of
// total games so usage stays a meaningful, finite, descending-sortable number
// in both schemas (0 when neither field is present).
function leaderboardUsage(sp, totalGames) {
  const pct = parseFloat(sp.percent);
  if (Number.isFinite(pct)) return pct;
  const games = Number(sp.games);
  if (Number.isFinite(games) && totalGames > 0) {
    return Math.round((games / totalGames) * 1000) / 10;
  }
  return 0;
}

function totalLeaderboardGames(leaderboard) {
  return leaderboard.reduce((sum, sp) => sum + (Number(sp.games) || 0), 0);
}

// Canonical usage ordering. Pikalytics ranks by % of teams, but the field
// exposing that order differs by schema: M-A carries `percent`, M-B carries an
// explicit `rank`. Return a key where ASCENDING sort puts the most-used first,
// so the top-N selections match Pikalytics's own ordering in both schemas.
function leaderboardSortKey(sp) {
  const pct = parseFloat(sp.percent);
  if (Number.isFinite(pct)) return -pct; // M-A: higher percent ranks first
  const rank = parseInt(sp.rank, 10);
  if (Number.isFinite(rank)) return rank; // M-B: lower rank ranks first
  return Number.MAX_SAFE_INTEGER;
}

function transformThreats(leaderboard) {
  const totalGames = totalLeaderboardGames(leaderboard);
  return leaderboard
    .slice()
    .sort((a, b) => leaderboardSortKey(a) - leaderboardSortKey(b))
    .slice(0, TOP_THREATS_COUNT)
    .map((sp, i) => ({
      species: canonicalSpecies(sp.name),
      usagePercent: leaderboardUsage(sp, totalGames),
      winRate: parseFloat(sp.winPercent ?? '0'),
      rank: i + 1,
    }));
}

function transformPool(leaderboard) {
  const totalGames = totalLeaderboardGames(leaderboard);
  return leaderboard
    .slice()
    .sort((a, b) => leaderboardSortKey(a) - leaderboardSortKey(b))
    .slice(0, TOP_POOL_COUNT)
    .map((sp) => ({
      species: canonicalSpecies(sp.name),
      types: sp.types ?? [],
      usagePercent: leaderboardUsage(sp, totalGames),
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
      .sort((a, b) => leaderboardSortKey(a) - leaderboardSortKey(b));
    const targetSet = new Set(byUsage.slice(0, BUILDS_LIMIT).map((sp) => sp.name));
    for (const t of topteams.landingTeams ?? []) {
      for (const m of t.pokemon ?? []) {
        if (m.name) targetSet.add(m.name);
      }
    }
    // Always-mega mons (Charizard, Gardevoir, …) appear in the M-B leaderboard
    // only as their mega forme(s), whose /api/p carries no EV spread. Fetch the
    // base species too — its /api/p has the real aggregate spread we graft onto
    // the mega variants in transformBuilds.
    for (const name of [...targetSet]) {
      const base = name.replace(/-Mega(?:-[XY])?$/, '');
      if (base !== name) targetSet.add(base);
    }
    const targetNames = [...targetSet];
    console.log(`fetching /api/p for ${targetNames.length} species (pass 1, concurrency ${FETCH_CONCURRENCY})`);
    const perSpeciesMap = await fetchPerSpeciesBatch(period, targetNames);

    // Pass 2: discover mega formes from each base species' item usage and fetch
    // their endpoints (per-forme moves + stats). Deterministic — coverage no
    // longer depends on which mons happened to land in the top-team snapshot.
    const megaToFetch = new Set();
    for (const [name, blob] of perSpeciesMap) {
      if (/-Mega(?:-[XY])?$/.test(name)) continue;
      for (const it of blob.items ?? []) {
        const u = parseFloat(it.percent);
        if (!Number.isFinite(u) || u < MEGA_STONE_MIN_USAGE) continue;
        const forme = stoneFormeName(name, it.item);
        if (forme && !perSpeciesMap.has(forme)) megaToFetch.add(forme);
      }
    }
    if (megaToFetch.size > 0) {
      console.log(`fetching /api/p for ${megaToFetch.size} discovered mega formes (pass 2)`);
      const megaMap = await fetchPerSpeciesBatch(period, [...megaToFetch]);
      for (const [k, v] of megaMap) perSpeciesMap.set(k, v);
    }
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
