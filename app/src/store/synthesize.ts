import { Generations, toID } from '@smogon/calc';
import type { SavedMon, StatID } from '../types';
import { uuid } from '../util/uuid';
import { getLearnableMoveIds } from '../data/pkmn';

const GEN = Generations.get(0);

/**
 * Synthesizes a "max-offense" build for any species: max best-attack stat
 * + max speed, nature picked to push the chosen stats further, and the
 * top four highest-BP moves from the species's learnset (preferring the
 * category that matches the chosen attack stat).
 *
 * Algorithm:
 *   - bestAtk = atk vs spa (whichever base stat is higher)
 *   - if base spe ≥ 90 (already fast) → nature +Spe -worstAtk; max bestAtk + Spe
 *   - else → nature +bestAtk -worstAtk; max bestAtk + Spe
 *   - SPs: bestAtk = 32, spe = 32, hp = 2 (sum = 66)
 *   - moves: top 4 by BP, matching-category first; status moves excluded
 *   - ability: species's first canonical ability
 */
const FAST_THRESHOLD = 90;

const NATURE_TABLE: Record<string, Record<string, string>> = {
  atk: { def: 'Lonely',  spa: 'Adamant', spd: 'Naughty', spe: 'Brave'   },
  def: { atk: 'Bold',    spa: 'Impish',  spd: 'Lax',     spe: 'Relaxed' },
  spa: { atk: 'Modest',  def: 'Mild',    spd: 'Rash',    spe: 'Quiet'   },
  spd: { atk: 'Calm',    def: 'Gentle',  spa: 'Careful', spe: 'Sassy'   },
  spe: { atk: 'Timid',   def: 'Hasty',   spa: 'Jolly',   spd: 'Naive'   },
};

function natureFor(plus: StatID, minus: StatID): string {
  return NATURE_TABLE[plus]?.[minus] ?? 'Hardy';
}

export interface SynthSummary {
  bestAtk: 'atk' | 'spa';
  isFast: boolean;
  nature: string;
}

export function summarizeSynth(species: string): SynthSummary | null {
  const sp = GEN.species.get(toID(species) as any);
  if (!sp) return null;
  const base = sp.baseStats;
  const bestAtk: 'atk' | 'spa' = base.atk >= base.spa ? 'atk' : 'spa';
  const worstAtk: 'atk' | 'spa' = bestAtk === 'atk' ? 'spa' : 'atk';
  const isFast = base.spe >= FAST_THRESHOLD;
  const plus: StatID = isFast ? 'spe' : bestAtk;
  const minus: StatID = worstAtk;
  return { bestAtk, isFast, nature: natureFor(plus, minus) };
}

export async function synthesizeBuild(species: string): Promise<SavedMon | null> {
  const sp = GEN.species.get(toID(species) as any);
  if (!sp) return null;
  const summary = summarizeSynth(species);
  if (!summary) return null;
  const { bestAtk, isFast, nature } = summary;

  const sps: Partial<Record<StatID, number>> = {
    [bestAtk]: 32,
    spe: 32,
    hp: 2,
  };

  // Filter candidate moves: any non-status move the species can learn.
  // If learnset lookup fails or returns empty (species not in @pkmn/data),
  // accept any non-status move from the calc gen-0 table - better to ship
  // a synth build with possibly-illegal moves than zero moves at all.
  const learnable = await getLearnableMoveIds(species).catch(() => new Set<string>());
  const candidates: { name: string; bp: number; cat: string }[] = [];
  const wantPhysical = bestAtk === 'atk';
  for (const m of GEN.moves) {
    const id = toID(m.name) as unknown as string;
    if (learnable.size > 0 && !learnable.has(id)) continue;
    const bp = ((m as any).bp ?? (m as any).basePower ?? 0) as number;
    if (bp === 0) continue;
    const cat = (m.category as string) ?? '';
    candidates.push({ name: m.name, bp, cat });
  }
  candidates.sort((a, b) => {
    // Matching-category first, then by BP desc.
    const aMatch = (a.cat === 'Physical') === wantPhysical ? 0 : 1;
    const bMatch = (b.cat === 'Physical') === wantPhysical ? 0 : 1;
    if (aMatch !== bMatch) return aMatch - bMatch;
    return b.bp - a.bp;
  });
  const top = candidates.slice(0, 4);
  const moves: [string, string, string, string] = [
    top[0]?.name ?? '', top[1]?.name ?? '', top[2]?.name ?? '', top[3]?.name ?? '',
  ];

  const abilities = sp.abilities ?? {};
  const ability = (Object.values(abilities)[0] as string | undefined) ?? undefined;

  void isFast;

  return {
    id: uuid(),
    species,
    nature,
    sps,
    moves,
    mega: '',
    boosts: {},
    ability,
  };
}
