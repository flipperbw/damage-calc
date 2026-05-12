import { useMemo } from 'react';

import type { MoveResult } from '@/calc/adapter';
import { categoryBadge, effectivenessBadge, koBadge, koTagFromText, priorityFlag, type MoveCategory } from '@/calc/format';
import { GEN, toID } from '@/calc/gen';
import { PickerShell } from '@/components/pickers/PickerShell';
import { ProseBlock } from '@/components/ProseBlock';
import { TypeBadge } from '@/components/TypeBadge';
import { useDescription } from '@/components/useDescription';
import { moveAccuracy, priorityOverride } from '@/data/pkmn';

interface Props {
  open: boolean;
  moveName: string | null;
  /** Optional live-matchup result, when this is being opened from a battle row. */
  result?: MoveResult;
  onClose: () => void;
}

/**
 * Compose a human-readable description from the structured calc data. The
 * calc package doesn't ship prose descriptions per move, so we render the
 * relevant facts (BP, priority, multihit, recoil, drain, secondaries, flags)
 * from the Move record, plus the live matchup numbers when provided.
 */
export function MoveDetailSheet({ open, moveName, result, onClose }: Props) {
  const move = useMemo(() => {
    if (!moveName) return null;
    return GEN.moves.get(toID(moveName) as any) ?? null;
  }, [moveName]);

  const prose = useDescription(moveName, 'move', open);

  if (!open || !moveName || !move) return null;

  const bp = (move as any).bp ?? move.basePower ?? 0;
  const category = move.category ?? 'Status';
  // Same fallback as adapter.ts: calc's gen-0 omits priority on several moves
  // (Trick Room, Roar, Whirlwind, …); use @pkmn/data when calc says 0.
  const calcPriority = move.priority ?? 0;
  const priorityFromPkmn = priorityOverride(move.name as string);
  const priority = calcPriority === 0 && priorityFromPkmn !== null ? priorityFromPkmn : calcPriority;
  // Accuracy is sourced from @pkmn/data via moveAccuracy() — calc's gen-0
  // table doesn't carry it. `true` = bypass accuracy check; only worth
  // calling out for damaging moves (Aerial Ace, Swift, Shadow Punch, …).
  // Status moves are auto-hit as a class so we don't repeat the obvious.
  const acc = moveAccuracy(move.name as string);
  const accuracyLabel =
    acc === true ? (category === 'Status' ? '-' : 'Always hits') : typeof acc === 'number' ? `${acc}%` : '-';
  const flags = move.flags ?? {};

  const multihit = move.multihit;
  const multihitText = (() => {
    if (multihit === undefined) return null;
    if (typeof multihit === 'number') return `Hits ${multihit} time${multihit === 1 ? '' : 's'}`;
    if (Array.isArray(multihit)) return `Hits ${multihit[0]}–${multihit[1]} times`;
    return null;
  })();

  const recoil = move.recoil;
  const recoilText = recoil ? `${Math.round((recoil[0] / recoil[1]) * 100)}% recoil` : null;
  const drain = move.drain;
  const drainText = drain ? `Heals ${Math.round((drain[0] / drain[1]) * 100)}% of damage dealt` : null;

  const secondary = move.secondaries;
  const secondaryText = describeSecondary(secondary);

  const f = flags as Record<string, unknown>;
  const flagChips: { key: string; label: string }[] = [];
  if (f.contact) flagChips.push({ key: 'contact', label: 'Contact' });
  if (f.sound) flagChips.push({ key: 'sound', label: 'Sound' });
  if (f.bullet) flagChips.push({ key: 'bullet', label: 'Bullet' });
  if (f.bite) flagChips.push({ key: 'bite', label: 'Bite' });
  if (f.punch) flagChips.push({ key: 'punch', label: 'Punch' });
  if (f.pulse) flagChips.push({ key: 'pulse', label: 'Pulse' });
  if (f.slicing) flagChips.push({ key: 'slicing', label: 'Slicing' });
  if (f.wind) flagChips.push({ key: 'wind', label: 'Wind' });
  if ((move as any).breaksProtect) flagChips.push({ key: 'breaks-protect', label: 'Breaks Protect' });
  if (f.charge) flagChips.push({ key: 'charge', label: 'Charge turn' });
  if (f.recharge) flagChips.push({ key: 'recharge', label: 'Recharge turn' });

  const ko = result ? koTagFromText(result.koChanceText) : null;
  const eff = result ? effectivenessBadge(result.effectiveness, result.isStatus) : null;

  return (
    <PickerShell open={open} onClose={onClose} title={undefined}>
      <div className="overflow-y-auto -mx-1 px-1">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <TypeBadge type={String(move.type)} size="md" />
          <h3 className="text-lg font-bold flex-1">{move.name}</h3>
          <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded ${categoryBadge(category as MoveCategory).cls}`}>
            {category}
          </span>
        </div>

        {/* Prose description from @pkmn/data. Some newer (SV-era) moves
            aren't in our gen-7 dataset and will silently render nothing -
            the structured info below still tells the user what the move
            does in mechanical terms. */}
        <ProseBlock state={prose} testId="move-prose" />

        {result?.isImmune && (
          <div className="mb-3 p-3 rounded-card bg-surface border border-surface-hi text-sm" data-testid="move-immune">
            <span className="font-bold opacity-90">Immune</span>
            <span className="opacity-60"> — this move does no damage to the current opponent (type or ability immunity).</span>
          </div>
        )}

        {/* Live matchup info, when available */}
        {result && !result.isStatus && !result.isImmune && (
          <div className="mb-3 p-3 rounded-card bg-surface border border-surface-hi">
            <div className="text-xxs uppercase tracking-wider opacity-55 mb-1.5">Vs current opponent</div>
            <div className="flex items-baseline justify-between mb-1">
              <span className="font-bold tabular-nums text-base">
                {result.percentRange[0]}–{result.percentRange[1]}%
              </span>
              <span className="text-xs opacity-70">
                {result.damageRange[0]}–{result.damageRange[1]} dmg
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ko && (
                <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${koBadge(ko.kind).cls}`}>{ko.label}</span>
              )}
              {eff && <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${eff.cls}`}>{eff.label}</span>}
              {result.koChanceText && <span className="text-xs opacity-65">{result.koChanceText}</span>}
            </div>
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <Stat label="Base Power" value={bp > 0 ? String(bp) : '-'} />
          <Stat label="Accuracy" value={accuracyLabel} />
          <Stat label="Priority" value={priority === 0 ? '0' : (priorityFlag(priority) ?? '0')} />
        </div>

        {/* Effects list */}
        {(multihitText || recoilText || drainText || secondaryText) && (
          <div className="mb-3">
            <div className="text-xxs uppercase tracking-wider opacity-55 mb-1.5">Effects</div>
            <ul className="space-y-1 text-sm">
              {multihitText && <li>• {multihitText}</li>}
              {recoilText && <li>• {recoilText}</li>}
              {drainText && <li>• {drainText}</li>}
              {secondaryText && <li>• {secondaryText}</li>}
            </ul>
          </div>
        )}

        {/* Flags */}
        {flagChips.length > 0 && (
          <div className="mb-3">
            <div className="text-xxs uppercase tracking-wider opacity-55 mb-1.5">Flags</div>
            <div className="flex flex-wrap gap-1.5">
              {flagChips.map((c) => (
                <span key={c.key} className="text-[11px] px-2 py-0.5 rounded-lg bg-surface border border-surface-hi">
                  {c.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </PickerShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface border border-surface-hi rounded-lg p-2">
      <div className="text-xxs uppercase tracking-wider opacity-55">{label}</div>
      <div className="text-base font-bold tabular-nums">{value}</div>
    </div>
  );
}

/**
 * Best-effort summary of the move's `secondaries` field, which calc types as
 * `any`. We try common shapes (single object with chance/status/boosts/etc.)
 * and fall back to a generic "has a secondary effect" line. This is forgiving
 * rather than exhaustive.
 */
function describeSecondary(s: any): string | null {
  if (!s) return null;
  const arr = Array.isArray(s) ? s : [s];
  const parts: string[] = [];
  for (const eff of arr) {
    if (!eff || typeof eff !== 'object') continue;
    const chance = typeof eff.chance === 'number' ? `${eff.chance}%` : '';
    if (eff.status) {
      parts.push(`${chance ? `${chance} chance to ` : ''}${statusVerb(eff.status)}`.trim());
    } else if (eff.volatileStatus) {
      const v = String(eff.volatileStatus);
      parts.push(`${chance ? `${chance} chance to ` : ''}cause ${v}`.trim());
    } else if (eff.boosts) {
      const stat = Object.keys(eff.boosts)[0];
      const delta = eff.boosts[stat];
      const dir = delta > 0 ? `raise ${stat} by ${delta}` : `lower ${stat} by ${Math.abs(delta)}`;
      parts.push(`${chance ? `${chance} chance to ` : ''}${dir}`.trim());
    } else if (eff.self?.boosts) {
      const stat = Object.keys(eff.self.boosts)[0];
      const delta = eff.self.boosts[stat];
      const dir = delta > 0 ? `raise user's ${stat} by ${delta}` : `lower user's ${stat} by ${Math.abs(delta)}`;
      parts.push(`${chance ? `${chance} chance to ` : ''}${dir}`.trim());
    } else {
      parts.push(`${chance ? `${chance} chance of ` : ''}secondary effect`.trim());
    }
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

function statusVerb(status: string): string {
  switch (status) {
    case 'brn':
      return 'burn';
    case 'par':
      return 'paralyze';
    case 'psn':
      return 'poison';
    case 'tox':
      return 'badly poison';
    case 'slp':
      return 'put to sleep';
    case 'frz':
      return 'freeze';
    default:
      return `inflict ${status}`;
  }
}
