import type { AppState } from '@/types';

/**
 * Type guard for the JSON the user pastes / uploads via Settings → Import.
 * Accepts any subset of persisted store keys but rejects obviously-wrong
 * shapes (non-array `teams`, function-valued fields from a raw store dump,
 * etc.). Lives outside SettingsScreen.tsx so the screen file exports only
 * the React component — keeps vite-plugin-react's Fast Refresh happy.
 */
export function isImportShape(value: unknown): value is Partial<AppState> {
  if (!value || typeof value !== 'object') return false;
  const v = value as any;
  if ('teams' in v && !Array.isArray(v.teams)) return false;
  if ('recentOpponents' in v && !Array.isArray(v.recentOpponents)) return false;
  if ('field' in v && (typeof v.field !== 'object' || v.field === null)) return false;
  if ('notation' in v && v.notation !== 'percent' && v.notation !== 'pixels') return false;
  if ('activeMonIndex' in v && typeof v.activeMonIndex !== 'number') return false;
  if ('activeTeamId' in v && v.activeTeamId !== null && typeof v.activeTeamId !== 'string') return false;
  // Action functions disqualify (means raw store state was dumped).
  for (const k of Object.keys(v)) {
    if (typeof v[k] === 'function') return false;
  }
  return true;
}
