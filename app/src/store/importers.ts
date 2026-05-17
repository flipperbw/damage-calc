import { MEGA_STONES } from '@smogon/calc';

import { GEN, toID } from '@/calc/gen';
import { megaFormeName } from '@/calc/helpers';
import { SP_PER_STAT_MAX, SP_TOTAL_MAX, STAT_LABEL, STAT_ORDER, type MegaState, type SavedMon, type StatID } from '@/types';

export type ImportChangeKind =
  | 'item-dropped'
  | 'ability-dropped'
  | 'move-dropped'
  | 'sps-scaled'
  | 'sps-clamped'
  | 'field-ignored'
  | 'mon-dropped';

export interface ImportChange {
  monIndex: number;
  kind: ImportChangeKind;
  field: string;
  before: string;
  after?: string;
  detail?: string;
}

export interface ParsedMon {
  draft: Omit<SavedMon, 'id'>;
  displayName: string;
}

export interface ParseResult {
  mons: ParsedMon[];
  teamName: string | null;
  changes: ImportChange[];
  unparseable: string[];
}

const SHOWDOWN_LABEL_TO_STAT: Record<string, StatID> = {
  HP: 'hp',
  Atk: 'atk',
  Def: 'def',
  SpA: 'spa',
  SpD: 'spd',
  Spe: 'spe',
};

function canonicalItem(name: string): string | undefined {
  const found = GEN.items.get(toID(name) as any);
  return found?.name;
}

function canonicalAbility(name: string): string | undefined {
  const found = GEN.abilities.get(toID(name) as any);
  return found?.name;
}

function canonicalMove(name: string): string | undefined {
  // "Hidden Power [Fire]" → "Hidden Power Fire"; Smogon-calc has typed variants
  // up to "Hidden Power Water" as separate move entries.
  const normalised = name.replace(/\s*\[([^\]]+)\]\s*$/, ' $1').trim();
  const found = GEN.moves.get(toID(normalised) as any);
  return found?.name;
}

function canonicalNature(name: string): string | undefined {
  const found = GEN.natures.get(toID(name) as any);
  return found?.name;
}

function stripMegaSuffix(species: string): string {
  if (species.endsWith('-Mega-X') || species.endsWith('-Mega-Y')) return species.slice(0, -7);
  if (species.endsWith('-Mega')) return species.slice(0, -5);
  return species;
}

function megaStateForItem(species: string, item: string | undefined): MegaState {
  if (!item) return '';
  const entry = (MEGA_STONES as Record<string, Record<string, string>>)[item];
  const forme = entry?.[species];
  if (!forme) return '';
  if (forme.endsWith('-Mega-X')) return 'mega-x';
  if (forme.endsWith('-Mega-Y')) return 'mega-y';
  return 'mega';
}

const FIELD_IGNORED_PREFIXES: { re: RegExp; field: string }[] = [
  { re: /^Level\s*:/i, field: 'level' },
  { re: /^Tera\s*Type\s*:/i, field: 'tera' },
  { re: /^Shiny\s*:/i, field: 'shiny' },
  { re: /^Gigantamax\s*:/i, field: 'gmax' },
  { re: /^Dynamax\s+Level\s*:/i, field: 'dynamax' },
  { re: /^Happiness\s*:/i, field: 'happiness' },
  { re: /^IVs\s*:/i, field: 'ivs' },
  { re: /^Gender\s*:/i, field: 'gender' },
  { re: /^Hyper\s*Trained/i, field: 'hyper-trained' },
];

interface RawMon {
  rawHead: string;
  speciesHead: string;
  nickname?: string;
  itemHead?: string;
  ability?: string;
  nature?: string;
  evs: Partial<Record<StatID, number>>;
  hasEvLine: boolean;
  moves: string[];
  fieldIgnored: { field: string; before: string }[];
  garbageLines: string[];
}

function parseBlock(block: string): RawMon | null {
  const lines = block.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) return null;
  const head = lines[0];
  // Bail on blocks that obviously aren't a mon (stray header, orphaned move
  // line, etc.). They get bubbled up as unparseable.
  if (head.startsWith('===') || head.startsWith('- ')) return null;

  const raw: RawMon = {
    rawHead: head,
    speciesHead: '',
    evs: {},
    hasEvLine: false,
    moves: [],
    fieldIgnored: [],
    garbageLines: [],
  };

  // Head: "Species[-Mega...] [(Nickname|CanonicalSpecies)] [@ Item]"
  let work = head;
  const atIdx = work.indexOf(' @ ');
  if (atIdx >= 0) {
    raw.itemHead = work.slice(atIdx + 3).trim();
    work = work.slice(0, atIdx).trim();
  }
  const nickMatch = work.match(/\(([^)]+)\)\s*$/);
  if (nickMatch) {
    const inner = nickMatch[1];
    // Showdown convention: "Nicky (Garchomp) @ Item" puts the canonical
    // species in parens when the nickname differs. If the parens content
    // resolves to a real species, treat it as the species and the leading
    // text as the nickname. Otherwise the parens content is just a nickname.
    const innerBase = stripMegaSuffix(inner);
    const isSpecies = !!GEN.species.get(toID(innerBase) as any);
    if (isSpecies) {
      raw.nickname = work.slice(0, nickMatch.index).trim();
      work = inner.trim();
    } else {
      raw.nickname = inner;
      work = work.slice(0, nickMatch.index).trim();
    }
  }
  raw.speciesHead = work;

  for (const line of lines.slice(1)) {
    if (line.startsWith('- ')) {
      raw.moves.push(line.slice(2).trim());
      continue;
    }
    if (/^Ability\s*:/i.test(line)) {
      raw.ability = line.replace(/^Ability\s*:\s*/i, '').trim();
      continue;
    }
    if (/^EVs\s*:/i.test(line)) {
      raw.hasEvLine = true;
      const body = line.replace(/^EVs\s*:\s*/i, '');
      for (const part of body.split('/')) {
        const m = part.trim().match(/^(\d+)\s+(\w+)$/);
        if (!m) continue;
        const value = parseInt(m[1], 10);
        const stat = SHOWDOWN_LABEL_TO_STAT[m[2]];
        if (!stat) continue;
        raw.evs[stat] = value;
      }
      continue;
    }
    if (/\sNature\s*$/i.test(line)) {
      raw.nature = line.replace(/\s*Nature\s*$/i, '').trim();
      continue;
    }
    let matched = false;
    for (const ig of FIELD_IGNORED_PREFIXES) {
      if (ig.re.test(line)) {
        raw.fieldIgnored.push({ field: ig.field, before: line });
        matched = true;
        break;
      }
    }
    if (!matched) raw.garbageLines.push(line);
  }

  return raw;
}

function looksLikeLiteralSps(evs: Partial<Record<StatID, number>>): boolean {
  const values = Object.values(evs);
  if (values.length === 0) return true;
  if (values.some((v) => v > SP_PER_STAT_MAX)) return false;
  const total = values.reduce((a, b) => a + b, 0);
  return total <= SP_TOTAL_MAX;
}

interface SpConversion {
  sps: Partial<Record<StatID, number>>;
  scaled: boolean;
  clamped: boolean;
  perStatDetail: string;
}

function convertEvsToSps(evs: Partial<Record<StatID, number>>): SpConversion {
  if (looksLikeLiteralSps(evs)) {
    const sps: Partial<Record<StatID, number>> = {};
    for (const [stat, v] of Object.entries(evs) as [StatID, number][]) {
      if (v > 0) sps[stat] = Math.min(SP_PER_STAT_MAX, v);
    }
    return { sps, scaled: false, clamped: false, perStatDetail: '' };
  }
  const sps: Partial<Record<StatID, number>> = {};
  const details: string[] = [];
  for (const stat of STAT_ORDER) {
    const ev = evs[stat] ?? 0;
    if (ev <= 0) continue;
    const scaled = Math.min(SP_PER_STAT_MAX, Math.round((ev * SP_PER_STAT_MAX) / 252));
    if (scaled > 0) {
      sps[stat] = scaled;
      details.push(`${STAT_LABEL[stat]} ${ev} → ${scaled}`);
    }
  }
  let total = (Object.values(sps) as number[]).reduce((a, b) => a + b, 0);
  let clamped = false;
  while (total > SP_TOTAL_MAX) {
    let smallestStat: StatID | null = null;
    let smallest = Infinity;
    for (const [s, v] of Object.entries(sps) as [StatID, number][]) {
      if (v > 0 && v < smallest) {
        smallest = v;
        smallestStat = s;
      }
    }
    if (!smallestStat) break;
    const cur = sps[smallestStat] ?? 0;
    if (cur <= 1) {
      delete sps[smallestStat];
    } else {
      sps[smallestStat] = cur - 1;
    }
    total -= 1;
    clamped = true;
  }
  return { sps, scaled: true, clamped, perStatDetail: details.join(', ') };
}

function formatEvs(evs: Partial<Record<StatID, number>>): string {
  const parts: string[] = [];
  for (const stat of STAT_ORDER) {
    const v = evs[stat];
    if (v && v > 0) parts.push(`${v} ${STAT_LABEL[stat]}`);
  }
  return parts.join(' / ');
}

function formatSps(sps: Partial<Record<StatID, number>>): string {
  const parts: string[] = [];
  for (const stat of STAT_ORDER) {
    const v = sps[stat];
    if (v && v > 0) parts.push(`${v} ${STAT_LABEL[stat]}`);
  }
  return parts.join(' / ') || 'none';
}

export function parseShowdownText(text: string): ParseResult {
  const changes: ImportChange[] = [];
  const unparseable: string[] = [];
  let teamName: string | null = null;
  let working = text.replace(/\r\n?/g, '\n');

  const headerMatch = working.match(/^\s*===\s*(.+?)\s*===\s*\n?/);
  if (headerMatch) {
    teamName = headerMatch[1].trim() || null;
    working = working.slice(headerMatch[0].length);
  }

  const blocks = working.split(/\n{2,}/).map((b) => b.trim()).filter((b) => b.length > 0);

  const parsedRaws: { raw: RawMon }[] = [];
  for (const block of blocks) {
    const raw = parseBlock(block);
    if (raw) {
      parsedRaws.push({ raw });
    } else {
      unparseable.push(block);
    }
  }

  const mons: ParsedMon[] = [];

  parsedRaws.forEach(({ raw }, monIndex) => {
    const species = stripMegaSuffix(raw.speciesHead).trim();
    if (!species) {
      unparseable.push(raw.rawHead);
      return;
    }

    let item: string | undefined;
    if (raw.itemHead) {
      const canon = canonicalItem(raw.itemHead);
      if (canon) {
        item = canon;
      } else {
        changes.push({
          monIndex,
          kind: 'item-dropped',
          field: 'item',
          before: raw.itemHead,
          detail: 'Not in Champions',
        });
      }
    }

    const mega = megaStateForItem(species, item);

    let ability: string | undefined;
    if (raw.ability) {
      const canon = canonicalAbility(raw.ability);
      if (canon) {
        ability = canon;
      } else {
        changes.push({
          monIndex,
          kind: 'ability-dropped',
          field: 'ability',
          before: raw.ability,
          detail: 'Not in Champions',
        });
      }
    }

    let nature = 'Hardy';
    if (raw.nature) {
      const canon = canonicalNature(raw.nature);
      if (canon) {
        nature = canon;
      } else {
        changes.push({
          monIndex,
          kind: 'field-ignored',
          field: 'nature',
          before: raw.nature,
          detail: 'Unknown nature; defaulted to Hardy',
        });
      }
    }

    const moves: [string, string, string, string] = ['', '', '', ''];
    let outSlot = 0;
    for (const rawMove of raw.moves) {
      if (outSlot >= 4) {
        changes.push({
          monIndex,
          kind: 'move-dropped',
          field: `moves[${outSlot}]`,
          before: rawMove,
          detail: 'Extra move beyond slot 4',
        });
        outSlot += 1;
        continue;
      }
      if (!rawMove) {
        outSlot += 1;
        continue;
      }
      const canon = canonicalMove(rawMove);
      if (canon) {
        moves[outSlot] = canon;
      } else {
        changes.push({
          monIndex,
          kind: 'move-dropped',
          field: `moves[${outSlot}]`,
          before: rawMove,
          detail: 'Not in Champions',
        });
      }
      outSlot += 1;
    }

    let sps: Partial<Record<StatID, number>> = {};
    if (raw.hasEvLine) {
      const conv = convertEvsToSps(raw.evs);
      sps = conv.sps;
      if (conv.scaled) {
        changes.push({
          monIndex,
          kind: 'sps-scaled',
          field: 'sps',
          before: formatEvs(raw.evs),
          after: formatSps(sps),
          detail: conv.perStatDetail,
        });
      }
      if (conv.clamped) {
        changes.push({
          monIndex,
          kind: 'sps-clamped',
          field: 'sps',
          before: '',
          detail: `Total trimmed to ${SP_TOTAL_MAX}`,
        });
      }
    }

    if (raw.nickname) {
      changes.push({ monIndex, kind: 'field-ignored', field: 'nickname', before: raw.nickname });
    }
    for (const fi of raw.fieldIgnored) {
      changes.push({ monIndex, kind: 'field-ignored', field: fi.field, before: fi.before });
    }
    for (const g of raw.garbageLines) {
      unparseable.push(g);
    }

    const draft: Omit<SavedMon, 'id'> = {
      species,
      item,
      ability,
      nature,
      sps,
      moves,
      mega,
      boosts: {},
    };

    mons.push({
      draft,
      displayName: megaFormeName(species, mega),
    });
  });

  return { mons, teamName, changes, unparseable };
}
