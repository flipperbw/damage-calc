import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { spriteUrl } from '@/data/sprites';
import { useStore } from '@/store';
import { type ImportChange, type ImportChangeKind, parseShowdownText, type ParsedMon } from '@/store/importers';
import type { SavedMon } from '@/types';
import { uuid } from '@/util/uuid';

const TEAM_CAP = 6;
const EXAMPLE = `Garchomp @ Choice Scarf\nAbility: Rough Skin\nEVs: 32 Atk / 32 Spe\nAdamant Nature\n- Earthquake\n- Outrage\n- Stone Edge\n- Fire Fang`;

type Props =
  | { mode: 'team'; open: boolean; onClose: () => void }
  | { mode: 'slot'; open: boolean; onClose: () => void; onPick: (draft: Omit<SavedMon, 'id'>) => void };

export function ShowdownImportDialog(props: Props) {
  const { open, onClose, mode } = props;
  const [text, setText] = useState('');
  const [debounced, setDebounced] = useState('');

  const createTeam = useStore((s) => s.createTeam);
  const upsertMon = useStore((s) => s.upsertMon);

  // Debounce parsing so each keystroke doesn't run the full parser. 100ms is
  // imperceptible but cuts work on long pastes.
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => setDebounced(text), 100);
    return () => window.clearTimeout(id);
  }, [text, open]);

  // Reset state whenever the dialog opens. (Closing is handled by the
  // parent unmounting via `open` toggle in most cases, but keep state clean
  // in case it stays mounted.)
  useEffect(() => {
    if (open) {
      setText('');
      setDebounced('');
    }
  }, [open]);

  const parsed = useMemo(() => parseShowdownText(debounced), [debounced]);

  if (!open) return null;

  const hasContent = debounced.trim().length > 0;
  const hasMons = parsed.mons.length > 0;
  const adjustments = parsed.changes.length;

  function commitTeam(parsedMons: ParsedMon[], teamName: string | null) {
    const trimmed = parsedMons.slice(0, TEAM_CAP);
    const droppedCount = parsedMons.length - trimmed.length;
    const name = teamName?.trim() || `${trimmed[0]?.draft.species ?? 'Imported'}'s team`;
    const id = createTeam({ name, format: 'singles' });
    for (const pm of trimmed) {
      const saved: SavedMon = { id: uuid(), ...pm.draft };
      upsertMon(id, saved);
    }
    useStore.getState().setTab('battle');
    if (droppedCount > 0) {
      toast.success(`Imported ${trimmed.length} mons (${droppedCount} dropped — team cap is ${TEAM_CAP})`);
    } else {
      toast.success(`Imported ${trimmed.length} mon${trimmed.length === 1 ? '' : 's'}`);
    }
    onClose();
  }

  function fillSlot(pm: ParsedMon) {
    if (mode !== 'slot') return;
    props.onPick(pm.draft);
    toast.success(`Filled slot with ${pm.displayName}`);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-30 bg-black/60 flex items-end md:items-center md:justify-end" onClick={onClose}>
      <div
        className="w-full md:w-[480px] md:h-screen bg-bg-base bg-panel-gradient border border-surface-hi rounded-t-card md:rounded-none max-h-[90vh] md:max-h-screen flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center px-4 pt-4 mb-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close import"
            style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'rgba(255,255,255,0.15)' }}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-lg opacity-70 select-none cursor-pointer"
          >
            ←
          </button>
          <span className="font-bold">Import Showdown</span>
          <div className="w-[44px]" aria-hidden />
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 [overscroll-behavior:contain]">
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste a Showdown team or single mon block here"
            spellCheck={false}
            data-testid="showdown-import-textarea"
            className="w-full h-40 bg-surface border border-surface-hi rounded-lg px-3 py-2 mt-2 text-sm font-mono [overscroll-behavior:contain]"
            style={{ fontSize: 14 }}
          />

          {!hasContent && (
            <div className="mt-4 text-xs opacity-60 leading-relaxed">
              <div className="mb-2">Paste a team from Showdown / Smogon. Multiple mons separated by blank lines.</div>
              <pre className="text-[11px] bg-surface border border-surface-hi rounded-lg p-2 whitespace-pre-wrap leading-snug">
                {EXAMPLE}
              </pre>
            </div>
          )}

          {hasContent && !hasMons && (
            <div className="mt-4 text-xs text-danger" data-testid="showdown-import-empty">
              Couldn&apos;t detect any mons. Each block should start with a species name on its own line.
            </div>
          )}

          {hasMons && (
            <div className="mt-4">
              <div className="text-xxs uppercase tracking-wider opacity-55 mb-2">
                {parsed.mons.length} mon{parsed.mons.length === 1 ? '' : 's'} detected
                {adjustments > 0 ? ` · ${adjustments} adjustment${adjustments === 1 ? '' : 's'}` : ''}
                {parsed.teamName ? ` · "${parsed.teamName}"` : ''}
              </div>
              {parsed.mons.length > TEAM_CAP && (
                <div className="mb-3 text-xxs text-warn bg-warn/10 border border-warn/30 rounded-lg px-2 py-1.5">
                  {parsed.mons.length} mons — only the first {TEAM_CAP} will be imported as a team.
                </div>
              )}
              <div className="flex flex-col gap-2">
                {parsed.mons.map((pm, i) => (
                  <MonRow key={i} pm={pm} changes={parsed.changes.filter((c) => c.monIndex === i)} overCap={i >= TEAM_CAP} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 px-4 pt-3 pb-[calc(1rem+var(--safe-bottom,0px))] border-t border-surface-hi bg-bg-base flex flex-col gap-2">
          {mode === 'team' && (
            <button
              type="button"
              disabled={!hasMons}
              onClick={() => commitTeam(parsed.mons, parsed.teamName)}
              data-testid="showdown-import-commit-team"
              className={`w-full py-3 rounded-card font-bold text-base ${hasMons ? 'bg-accent-gradient text-white' : 'bg-white/10 text-white/40 cursor-not-allowed'}`}
            >
              Import as new team
            </button>
          )}
          {mode === 'slot' && parsed.mons.length === 1 && (
            <button
              type="button"
              onClick={() => fillSlot(parsed.mons[0])}
              data-testid="showdown-import-commit-slot"
              className="w-full py-3 rounded-card font-bold text-base bg-accent-gradient text-white"
            >
              Fill slot with {parsed.mons[0].displayName}
            </button>
          )}
          {mode === 'slot' && parsed.mons.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => fillSlot(parsed.mons[0])}
                data-testid="showdown-import-commit-slot-first"
                className="w-full py-3 rounded-card font-bold text-sm bg-accent-gradient text-white"
              >
                Fill slot with {parsed.mons[0].displayName}
              </button>
              <button
                type="button"
                onClick={() => commitTeam(parsed.mons, parsed.teamName)}
                data-testid="showdown-import-commit-slot-team"
                className="w-full py-3 rounded-card font-semibold text-sm bg-surface border border-surface-hi"
              >
                Import all {Math.min(parsed.mons.length, TEAM_CAP)} as new team
              </button>
            </>
          )}
          {mode === 'slot' && parsed.mons.length === 0 && (
            <button
              type="button"
              disabled
              className="w-full py-3 rounded-card font-bold text-base bg-white/10 text-white/40 cursor-not-allowed"
            >
              Paste a mon to import
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function chipClass(kind: ImportChangeKind): string {
  switch (kind) {
    case 'sps-scaled':
    case 'sps-clamped':
      return 'bg-warn/10 text-warn border-warn/30';
    case 'item-dropped':
    case 'ability-dropped':
    case 'move-dropped':
    case 'mon-dropped':
      return 'bg-danger/10 text-danger border-danger/30';
    case 'field-ignored':
    default:
      return 'bg-white/[0.04] text-text-mute border-surface-hi';
  }
}

function chipLabel(c: ImportChange): string {
  switch (c.kind) {
    case 'item-dropped':
      return `Item dropped: ${c.before}`;
    case 'ability-dropped':
      return `Ability dropped: ${c.before}`;
    case 'move-dropped':
      return `Move dropped: ${c.before}`;
    case 'sps-scaled':
      return c.detail ? `EVs scaled — ${c.detail}` : 'EVs scaled';
    case 'sps-clamped':
      return c.detail ?? 'SPs clamped';
    case 'field-ignored':
      return c.detail ? `Ignored ${c.field}: ${c.detail}` : `Ignored ${c.field}`;
    case 'mon-dropped':
      return `Mon dropped: ${c.before}`;
  }
}

function MonRow({ pm, changes, overCap }: { pm: ParsedMon; changes: ImportChange[]; overCap: boolean }) {
  const { draft, displayName } = pm;
  const moves = draft.moves.filter((m) => m).join(', ') || '—';
  const spParts: string[] = [];
  for (const [stat, v] of Object.entries(draft.sps)) {
    if (v && v > 0) spParts.push(`${v} ${stat.toUpperCase()}`);
  }
  const sps = spParts.join(' / ') || 'no EVs';
  return (
    <div className={`rounded-lg border p-2 ${overCap ? 'border-danger/40 opacity-60' : 'border-surface-hi bg-surface'}`}>
      <div className="flex items-center gap-2">
        <img src={spriteUrl(draft.species)} className="w-9 h-9 rounded shrink-0" alt="" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{displayName}</div>
          <div className="text-[11px] opacity-60 truncate">
            {draft.item ?? '— no item —'} · {draft.ability ?? '— no ability —'} · {draft.nature}
          </div>
          <div className="text-[10px] opacity-50 truncate">{moves}</div>
          <div className="text-[10px] opacity-50 truncate">{sps}</div>
        </div>
      </div>
      {changes.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {changes.map((c, i) => (
            <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded border ${chipClass(c.kind)}`}>
              {chipLabel(c)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
