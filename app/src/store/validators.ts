import { RECENT_OPPONENT_CAP, SP_PER_STAT_MAX, SP_TOTAL_MAX, type RecentOpponent, type SavedMon, type StatID } from '@/types';

export interface SpValidation {
  ok: boolean;
  total: number;
  error?: string;
}

export function validateSps(sps: Partial<Record<StatID, number>>): SpValidation {
  const entries = Object.entries(sps) as [StatID, number][];
  // Sum first so the reported `total` always reflects every stat, even when
  // one of them blows the per-stat cap.
  let total = 0;
  for (const [, value] of entries) total += value;
  for (const [stat, value] of entries) {
    if (value > SP_PER_STAT_MAX) {
      return { ok: false, total, error: `${stat} exceeds ${SP_PER_STAT_MAX}` };
    }
  }
  if (total > SP_TOTAL_MAX) {
    return { ok: false, total, error: `total exceeds ${SP_TOTAL_MAX}` };
  }
  return { ok: true, total };
}

export function addRecent(existing: RecentOpponent[], mon: SavedMon, now: number): RecentOpponent[] {
  const idx = existing.findIndex((r) => r.mon.species === mon.species);
  if (idx >= 0) {
    const bumped = {
      ...existing[idx],
      mon,
      lastUsed: now,
      useCount: existing[idx].useCount + 1,
    };
    return [bumped, ...existing.slice(0, idx), ...existing.slice(idx + 1)];
  }
  const fresh: RecentOpponent = { id: mon.species, mon, lastUsed: now, useCount: 1 };
  return [fresh, ...existing].slice(0, RECENT_OPPONENT_CAP);
}
