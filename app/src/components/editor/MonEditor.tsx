import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { SavedMon } from '../../types';
import { spriteUrl } from '../../data/sprites';
import { SpeciesPicker } from '../pickers/SpeciesPicker';
import { ItemPicker } from '../pickers/ItemPicker';
import { AbilityPicker } from '../pickers/AbilityPicker';
import { NaturePicker } from '../pickers/NaturePicker';
import { BuildDropdown } from './BuildDropdown';
import { SpGrid } from './SpGrid';
import { MoveSlots } from './MoveSlots';
import { EffectiveStats } from './EffectiveStats';
import { MegaToggle } from '../MegaToggle';
import { TypeBadge } from '../TypeBadge';
import { Generations, toID } from '@smogon/calc';
import { validateSps } from '../../store/validators';
import { monToShowdownText } from '../../store/exporters';
import { copyToClipboard } from '../../util/clipboard';
import { useConfirm } from '../ConfirmDialog';

const GEN = Generations.get(0);

interface Props {
  open: boolean;
  initial: SavedMon;
  onClose: () => void;
  onSave: (mon: SavedMon) => void;
  /**
   * Optional delete handler. When provided, a trash button is rendered in
   * the editor's top bar and tapping it (after confirm) calls onDelete and
   * closes the sheet. Only TeamsScreen wires this — the battle screen and
   * brand-new-mon flows shouldn't expose delete here.
   */
  onDelete?: () => void;
  /** Optional team name shown in the trash confirm body. */
  teamName?: string;
  /**
   * When true, the move picker defaults its "Lowers target" filter on —
   * the user is editing the opponent's mon and is most interested in
   * stat-lowering moves the opponent might use against them.
   */
  isForOpponent?: boolean;
}

/**
 * Shared "press" hook for the Copy/Trash buttons. iOS Brave occasionally
 * loses synthetic click events on transform/blur-styled buttons or grabs the
 * touch on the emoji glyph layer. Belt-and-suspenders fix:
 *   - emoji wrapped in `<span style={{ pointerEvents: 'none' }}>` so the hit
 *     target is the button itself.
 *   - run the action in `onPointerUp` AND `onClick`, but track a per-press
 *     ref so a successful pointerup doesn't double-fire when the click
 *     synthesizes after.
 *   - real fix is the clipboard / confirm refactor above; this just hardens
 *     against any remaining hit-test weirdness.
 */
function usePressHandlers(action: () => void) {
  const firedRef = useRef(false);
  // Reset shortly after a press so subsequent presses still work.
  function fire() {
    if (firedRef.current) return;
    firedRef.current = true;
    try { action(); } finally {
      // Microtask reset is enough — the click event after pointerup is
      // dispatched in the same task and would observe firedRef===true.
      setTimeout(() => { firedRef.current = false; }, 250);
    }
  }
  return {
    onClick: () => fire(),
    onPointerUp: () => fire(),
  };
}

export function MonEditor({ open, initial, onClose, onSave, onDelete, teamName, isForOpponent }: Props) {
  const [draft, setDraft] = useState<SavedMon>(initial);
  useEffect(() => setDraft(initial), [initial]);

  const [picker, setPicker] = useState<'species' | 'item' | 'ability' | 'nature' | null>(null);
  // Brief inline confirmation chip after a successful clipboard copy. Kept
  // alongside the toast so the editor itself shows feedback even if the
  // toast is dismissed/missed by the user.
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(id);
  }, [copied]);

  const confirm = useConfirm();

  async function handleCopy() {
    const text = monToShowdownText(draft);
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      toast.success('Copied to clipboard', { id: 'mon-copy' });
    } else {
      // Last-resort: log the text so a tech-savvy user can grab it from
      // devtools, then surface an error toast they can't miss.
      // eslint-disable-next-line no-console
      console.warn('[MonEditor] copy failed; text was:', text);
      toast.error('Could not copy to clipboard', { id: 'mon-copy' });
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    const where = teamName ? ` from ${teamName}` : '';
    const ok = await confirm(
      `${draft.species} will be removed${where}.`,
      { title: 'Remove from team?', danger: true, okLabel: 'Remove' },
    );
    if (!ok) return;
    onDelete();
    toast.success(`${draft.species} removed`);
  }

  const copyHandlers = usePressHandlers(handleCopy);
  const deleteHandlers = usePressHandlers(handleDelete);

  if (!open) return null;

  const speciesData = GEN.species.get(toID(draft.species) as any);
  const types = speciesData?.types ?? [];
  const valid = validateSps(draft.sps).ok;

  function patch(p: Partial<SavedMon>) {
    setDraft(prev => {
      const next = { ...prev, ...p };
      // Any change to fields backed by a curated build clears buildName.
      if ('item' in p || 'ability' in p || 'nature' in p || 'sps' in p || 'moves' in p) {
        if (p.buildName === undefined) next.buildName = undefined;
      }
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-30 bg-black/60 flex items-end md:items-center md:justify-end" onClick={onClose}>
      <div className="w-full md:w-[420px] md:h-screen bg-bg-base bg-panel-gradient border border-surface-hi rounded-t-card md:rounded-none p-4 max-h-[90vh] md:max-h-screen overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close editor"
            style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'rgba(255,255,255,0.15)' }}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-lg opacity-70 select-none cursor-pointer"
          >←</button>
          <span className="font-bold">Edit Pokémon</span>
          <div className="flex items-center gap-1">
            {copied && (
              <span
                data-testid="copy-confirmation"
                className="text-ok text-sm font-semibold mr-1"
                aria-live="polite"
              >✓ Copied</span>
            )}
            <button
              type="button"
              aria-label="Copy Pokémon to clipboard"
              {...copyHandlers}
              data-testid="copy-mon"
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'rgba(124,92,255,0.25)' }}
              className={`min-w-[44px] min-h-[44px] flex items-center justify-center text-lg rounded-lg select-none cursor-pointer ${copied ? 'bg-ok/20' : 'bg-surface border border-surface-hi'}`}
            >
              <span style={{ pointerEvents: 'none' }}>📋</span>
            </button>
            {onDelete ? (
              <button
                type="button"
                aria-label="Remove from team"
                {...deleteHandlers}
                data-testid="delete-mon"
                style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'rgba(255,107,107,0.3)' }}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-lg rounded-lg bg-danger/10 border border-danger/30 text-danger select-none cursor-pointer"
              >
                <span style={{ pointerEvents: 'none' }}>🗑</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* Hero */}
        <div className="flex gap-3 items-center mb-4 p-3 bg-danger/10 border border-danger/20 rounded-card">
          <button onClick={() => setPicker('species')}>
            <img src={spriteUrl(draft.species)} className="w-16 h-16 rounded" />
          </button>
          <div className="flex-1">
            <div className="font-extrabold text-lg cursor-pointer" onClick={() => setPicker('species')}>{draft.species}</div>
            <div className="flex gap-1 mt-1">{types.map(t => <TypeBadge key={t} type={t as string} />)}</div>
            <div className="mt-2"><MegaToggle mega={draft.mega} species={draft.species}
                                              item={draft.item}
                                              onChange={mega => patch({ mega })} /></div>
          </div>
        </div>

        {/* Build dropdown */}
        <div className="mb-3">
          <div className="text-xxs uppercase tracking-wider opacity-55 mb-1">Build</div>
          <BuildDropdown species={draft.species} selectedName={draft.buildName}
                         onApply={(p, name) => setDraft(d => ({ ...d, ...p, buildName: name }))} />
        </div>

        {/* Item / Ability / Nature */}
        <Field label="Item" value={draft.item ?? '— none —'} onClick={() => setPicker('item')} />
        <Field label="Ability" value={draft.ability ?? '— none —'} onClick={() => setPicker('ability')} />
        <Field label="Nature" value={draft.nature} onClick={() => setPicker('nature')} />

        {/* SP grid */}
        <div className="my-4">
          <SpGrid sps={draft.sps} onChange={sps => patch({ sps })} />
        </div>

        {/* Effective stats — also shows the post-mega column when item is a mega stone */}
        <div className="mb-4">
          <EffectiveStats
            species={draft.species}
            nature={draft.nature}
            sps={draft.sps}
            item={draft.item}
          />
        </div>

        {/* Moves */}
        <div className="mb-4">
          <div className="text-xxs uppercase tracking-wider opacity-55 mb-1">Moves</div>
          <MoveSlots species={draft.species} moves={draft.moves}
                     isForOpponent={isForOpponent}
                     onChange={moves => patch({ moves })} />
        </div>

        {/* Save */}
        <button disabled={!valid} onClick={() => onSave(draft)}
                className={`w-full py-3 rounded-card font-bold text-base ${valid ? 'bg-accent-gradient text-white' : 'bg-white/10 text-white/40 cursor-not-allowed'}`}>
          Save
        </button>

        <SpeciesPicker open={picker === 'species'} onClose={() => setPicker(null)}
                       showRecents={false} onPick={s => patch({ species: s })} />
        <ItemPicker open={picker === 'item'} species={draft.species}
                    onClose={() => setPicker(null)}
                    onPick={item => patch({ item })} />
        <AbilityPicker open={picker === 'ability'} species={draft.species} onClose={() => setPicker(null)}
                       onPick={ability => patch({ ability })} />
        <NaturePicker open={picker === 'nature'} onClose={() => setPicker(null)}
                      onPick={nature => patch({ nature })} />
      </div>
    </div>
  );
}

function Field({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <div className="mb-2">
      <div className="text-xxs uppercase tracking-wider opacity-55 mb-1">{label}</div>
      <button
        onClick={onClick}
        data-testid={`field-${label.toLowerCase()}`}
        className="w-full bg-surface border border-surface-hi rounded-lg px-3 py-2 text-sm flex justify-between items-center"
      >
        <span>{value}</span><span className="opacity-40">▾</span>
      </button>
    </div>
  );
}
