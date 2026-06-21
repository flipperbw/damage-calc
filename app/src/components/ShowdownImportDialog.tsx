import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Sprite } from '@/components/Sprite';
import { useStore } from '@/store';
import { type ImportChange, type ImportChangeKind, matchPokepasteId, parseShowdownText, type ParsedMon } from '@/store/importers';
import type { SavedMon } from '@/types';
import { uuid } from '@/util/uuid';

const TEAM_CAP = 6;
const EXAMPLE = `Garchomp @ Choice Scarf\nAbility: Rough Skin\nEVs: 32 Atk / 32 Spe\nAdamant Nature\n- Earthquake\n- Outrage\n- Stone Edge\n- Fire Fang`;

type Props =
  | { mode: 'team'; open: boolean; onClose: () => void }
  | {
      mode: 'slot';
      open: boolean;
      onClose: () => void;
      onPick: (draft: Omit<SavedMon, 'id'>) => void;
      /**
       * Species already in the same team that this slot belongs to, *excluding*
       * the slot's own current species. Used for Species Clause — a parsed mon
       * whose species is in here can't fill this slot (would create a duplicate
       * in the team).
       */
      excludeSpecies?: ReadonlySet<string>;
    };

export function ShowdownImportDialog(props: Props) {
  const { open, onClose, mode } = props;
  const excludeSpecies = mode === 'slot' ? props.excludeSpecies : undefined;
  const [text, setText] = useState('');
  const [debounced, setDebounced] = useState('');
  const [fetchingPokepaste, setFetchingPokepaste] = useState(false);

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
      setFetchingPokepaste(false);
    }
  }, [open]);

  // Pokepaste URL → fetch the raw paste, swap it into the textarea, and
  // let the existing showdown parser take it from there. Triggers any time
  // the textarea content is *just* a pokepaste link (no surrounding text)
  // so a paste-and-go flow works. The fetched text replaces the textarea
  // so the user can see and edit the resolved content before importing.
  useEffect(() => {
    if (!open) return;
    const id = matchPokepasteId(text);
    if (!id) return;
    let cancelled = false;
    setFetchingPokepaste(true);
    fetch(`https://pokepast.es/${id}/raw`)
      .then((res) => {
        if (!res.ok) throw new Error(`pokepaste returned ${res.status}`);
        return res.text();
      })
      .then((body) => {
        if (cancelled) return;
        if (!body.trim()) throw new Error('pokepaste returned an empty body');
        setText(body);
      })
      .catch((err) => {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.warn('[pokepaste] fetch failed', err);
        toast.error('Could not load pokepaste — check the URL or paste the team text directly');
      })
      .finally(() => {
        if (!cancelled) setFetchingPokepaste(false);
      });
    return () => {
      cancelled = true;
    };
  }, [text, open]);

  const parsed = useMemo(() => parseShowdownText(debounced), [debounced]);

  // Two kinds of duplicate detection:
  //   - inPaste: same species appears twice in the textarea. Always dropped
  //     on commit (whether to a new team or a slot fill).
  //   - inTeam: parsed species is already in the team the slot belongs to.
  //     Only blocks slot fills; "Import all as new team" makes a fresh team
  //     so existing-team duplicates don't apply.
  // The first occurrence of each species in the paste wins.
  const conflicts = useMemo(() => {
    const inPaste = new Set<number>();
    const inTeam = new Set<number>();
    const unknown = new Set<number>();
    const seen = new Set<string>();
    parsed.mons.forEach((pm, i) => {
      if (!pm.speciesKnown) {
        unknown.add(i);
        // Don't dedup-track unknown species — they won't commit either way.
        return;
      }
      const sp = pm.draft.species;
      if (excludeSpecies?.has(sp)) inTeam.add(i);
      else if (seen.has(sp)) inPaste.add(i);
      else seen.add(sp);
    });
    return { inPaste, inTeam, unknown };
  }, [parsed.mons, excludeSpecies]);

  if (!open) return null;

  const hasContent = debounced.trim().length > 0;
  const hasMons = parsed.mons.length > 0;
  const adjustments = parsed.changes.length;
  // First parsed mon that isn't blocked (duplicate or unknown) — what "Fill
  // slot" would actually use. When undefined, the fill action is disabled.
  const firstSlotEligible = parsed.mons.find(
    (pm, i) => pm.speciesKnown && !conflicts.inPaste.has(i) && !conflicts.inTeam.has(i),
  );

  function commitTeam(parsedMons: ParsedMon[], teamName: string | null) {
    // Drop unknown species (typos that don't resolve in GEN.species) and
    // in-paste duplicates (first occurrence of each species wins). inTeam
    // doesn't apply here — "Import as new team" always creates a fresh team.
    const dedupSeen = new Set<string>();
    const deduped: ParsedMon[] = [];
    let pasteDuplicates = 0;
    let unknownDropped = 0;
    for (const pm of parsedMons) {
      if (!pm.speciesKnown) {
        unknownDropped += 1;
        continue;
      }
      if (dedupSeen.has(pm.draft.species)) {
        pasteDuplicates += 1;
        continue;
      }
      dedupSeen.add(pm.draft.species);
      deduped.push(pm);
    }
    if (deduped.length === 0) {
      // Whole paste was unimportable — surface as an error rather than
      // creating an empty team.
      toast.error('No importable mons — check species spellings');
      return;
    }
    const trimmed = deduped.slice(0, TEAM_CAP);
    const overCap = deduped.length - trimmed.length;
    const name = teamName?.trim() || `${trimmed[0]?.draft.species ?? 'Imported'}'s team`;
    const id = createTeam({ name, format: 'singles' });
    for (const pm of trimmed) {
      const saved: SavedMon = { id: uuid(), ...pm.draft };
      upsertMon(id, saved);
    }
    useStore.getState().setTab('battle');
    const noteParts: string[] = [];
    if (unknownDropped > 0) noteParts.push(`${unknownDropped} unknown species dropped`);
    if (pasteDuplicates > 0) noteParts.push(`${pasteDuplicates} duplicate species dropped`);
    if (overCap > 0) noteParts.push(`${overCap} dropped — team cap is ${TEAM_CAP}`);
    const note = noteParts.length ? ` (${noteParts.join('; ')})` : '';
    toast.success(`Imported ${trimmed.length} mon${trimmed.length === 1 ? '' : 's'}${note}`);
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
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-lg opacity-70 select-none cursor-pointer transition-opacity hover:opacity-100"
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
            placeholder="Paste a Showdown team, single mon block, or pokepaste URL"
            spellCheck={false}
            data-testid="showdown-import-textarea"
            // iOS Safari auto-zooms any focused input/textarea whose
            // computed font-size is < 16px. Holding at exactly 16px keeps
            // the page locked at 1× when the user taps the paste area.
            className="w-full h-40 bg-surface border border-surface-hi rounded-lg px-3 py-2 mt-2 font-mono [overscroll-behavior:contain]"
            style={{ fontSize: 16 }}
          />

          {fetchingPokepaste && (
            <div className="mt-2 text-xs opacity-70 flex items-center gap-2" data-testid="pokepaste-fetching">
              <span className="inline-block w-3 h-3 rounded-full border-2 border-accent border-t-transparent animate-spin" aria-hidden />
              Fetching from pokepast.es…
            </div>
          )}

          {!hasContent && !fetchingPokepaste && (
            <div className="mt-4 text-xs opacity-60 leading-relaxed">
              <div className="mb-2">Paste a team from Showdown / Smogon (multiple mons separated by blank lines), or drop a <span className="font-mono">pokepast.es</span> URL on its own line.</div>
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
                  <MonRow
                    key={i}
                    pm={pm}
                    changes={parsed.changes.filter((c) => c.monIndex === i)}
                    overCap={i >= TEAM_CAP}
                    duplicateInPaste={conflicts.inPaste.has(i)}
                    duplicateInTeam={conflicts.inTeam.has(i)}
                    unknownSpecies={!pm.speciesKnown}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 px-4 pt-3 pb-[calc(1rem+var(--safe-bottom,0px))] border-t border-surface-hi bg-bg-base flex flex-col gap-2">
          {mode === 'team' &&
            (() => {
              const importable = parsed.mons.length - conflicts.inPaste.size - conflicts.unknown.size;
              const canCommit = importable > 0;
              return (
                <button
                  type="button"
                  disabled={!canCommit}
                  onClick={() => commitTeam(parsed.mons, parsed.teamName)}
                  data-testid="showdown-import-commit-team"
                  className={`w-full py-3 px-4 rounded-card font-bold text-base transition ${canCommit ? 'bg-accent-gradient text-white hover:brightness-110' : 'bg-white/10 text-white/40 cursor-not-allowed'}`}
                >
                  {canCommit
                    ? `Import as new team${importable < parsed.mons.length ? ` (${importable} of ${parsed.mons.length})` : ''}`
                    : 'No importable mons — check species spellings'}
                </button>
              );
            })()}
          {mode === 'slot' && parsed.mons.length === 1 && (
            <button
              type="button"
              onClick={() => firstSlotEligible && fillSlot(firstSlotEligible)}
              disabled={!firstSlotEligible}
              data-testid="showdown-import-commit-slot"
              className={`w-full py-3 rounded-card font-bold text-base transition ${firstSlotEligible ? 'bg-accent-gradient text-white hover:brightness-110' : 'bg-white/10 text-white/40 cursor-not-allowed'}`}
            >
              {firstSlotEligible
                ? `Fill slot with ${firstSlotEligible.displayName}`
                : !parsed.mons[0].speciesKnown
                  ? `"${parsed.mons[0].displayName}" isn't a recognized species`
                  : `${parsed.mons[0].displayName} is already in this team`}
            </button>
          )}
          {mode === 'slot' && parsed.mons.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => firstSlotEligible && fillSlot(firstSlotEligible)}
                disabled={!firstSlotEligible}
                data-testid="showdown-import-commit-slot-first"
                className={`w-full py-3 rounded-card font-bold text-sm transition ${firstSlotEligible ? 'bg-accent-gradient text-white hover:brightness-110' : 'bg-white/10 text-white/40 cursor-not-allowed'}`}
              >
                {firstSlotEligible
                  ? `Fill slot with ${firstSlotEligible.displayName}`
                  : 'No eligible mon (typos / duplicates)'}
              </button>
              {/* The "new team" path drops both unknowns and in-paste dups too,
                  so the eligible count is what's left after both filters. */}
              {(() => {
                const importable = parsed.mons.length - conflicts.inPaste.size - conflicts.unknown.size;
                return (
                  <button
                    type="button"
                    onClick={() => commitTeam(parsed.mons, parsed.teamName)}
                    disabled={importable === 0}
                    data-testid="showdown-import-commit-slot-team"
                    className={`w-full py-3 px-4 rounded-card font-semibold text-sm transition-colors ${importable === 0 ? 'bg-white/10 text-white/40 cursor-not-allowed' : 'bg-surface border border-surface-hi hover:border-accent/50 hover:bg-accent/[0.06]'}`}
                  >
                    {importable === 0
                      ? 'No importable mons'
                      : `Import all ${Math.min(importable, TEAM_CAP)} as new team`}
                  </button>
                );
              })()}
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

function MonRow({
  pm,
  changes,
  overCap,
  duplicateInPaste,
  duplicateInTeam,
  unknownSpecies,
}: {
  pm: ParsedMon;
  changes: ImportChange[];
  overCap: boolean;
  duplicateInPaste: boolean;
  duplicateInTeam: boolean;
  unknownSpecies: boolean;
}) {
  const { draft, displayName } = pm;
  const moves = draft.moves.filter((m) => m).join(', ') || '—';
  const spParts: string[] = [];
  for (const [stat, v] of Object.entries(draft.sps)) {
    if (v && v > 0) spParts.push(`${v} ${stat.toUpperCase()}`);
  }
  const sps = spParts.join(' / ') || 'no EVs';
  const dimmed = overCap || duplicateInPaste || duplicateInTeam || unknownSpecies;
  return (
    <div className={`rounded-lg border p-2 ${dimmed ? 'border-danger/40 opacity-60' : 'border-surface-hi bg-surface'}`}>
      <div className="flex items-center gap-2">
        {unknownSpecies ? (
          <div className="w-9 h-9 rounded shrink-0 bg-danger/10 border border-danger/30 flex items-center justify-center text-danger text-sm font-bold" aria-hidden>
            ?
          </div>
        ) : (
          <Sprite species={draft.species} className="w-9 h-9 rounded shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{displayName}</div>
          <div className="text-[11px] opacity-60 truncate">
            {draft.item ?? '— no item —'} · {draft.ability ?? '— no ability —'} · {draft.nature}
          </div>
          <div className="text-[10px] opacity-50 truncate">{moves}</div>
          <div className="text-[10px] opacity-50 truncate">{sps}</div>
        </div>
      </div>
      {(changes.length > 0 || duplicateInPaste || duplicateInTeam || unknownSpecies) && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {unknownSpecies && (
            <span className="text-[10px] px-1.5 py-0.5 rounded border bg-danger/10 text-danger border-danger/30">
              Unknown species — check spelling
            </span>
          )}
          {duplicateInTeam && (
            <span className="text-[10px] px-1.5 py-0.5 rounded border bg-danger/10 text-danger border-danger/30">
              Already in team — Species Clause
            </span>
          )}
          {duplicateInPaste && (
            <span className="text-[10px] px-1.5 py-0.5 rounded border bg-danger/10 text-danger border-danger/30">
              Duplicate in paste — dropped
            </span>
          )}
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
