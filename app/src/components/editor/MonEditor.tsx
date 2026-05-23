import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { GEN, toID } from '@/calc/gen';
import { megaFormeName } from '@/calc/helpers';
import { AbilityDetailSheet } from '@/components/AbilityDetailSheet';
import { useConfirm } from '@/components/ConfirmDialog';
import { BuildDropdown } from '@/components/editor/BuildDropdown';
import { EffectiveStats, megaFormeFromItem } from '@/components/editor/EffectiveStats';
import { MoveSlots } from '@/components/editor/MoveSlots';
import { SpGrid } from '@/components/editor/SpGrid';
import { MegaToggle } from '@/components/MegaToggle';
import { AbilityPicker } from '@/components/pickers/AbilityPicker';
import { ItemPicker } from '@/components/pickers/ItemPicker';
import { NaturePicker } from '@/components/pickers/NaturePicker';
import { SpeciesPicker } from '@/components/pickers/SpeciesPicker';
import { ShowdownImportDialog } from '@/components/ShowdownImportDialog';
import { TypeBadge } from '@/components/TypeBadge';
import { getBuildsForSpecies } from '@/data/setdex-champions';
import { Sprite } from '@/components/Sprite';
import { monToShowdownText } from '@/store/exporters';
import { monFromBuild } from '@/store/factories';
import { synthesizeBuild } from '@/store/synthesize';
import { validateSps } from '@/store/validators';
import type { SavedMon } from '@/types';
import { copyToClipboard } from '@/util/clipboard';

interface Props {
  open: boolean;
  initial: SavedMon;
  onClose: () => void;
  onSave: (mon: SavedMon) => void;
  /**
   * Optional delete handler. When provided, a trash button is rendered in
   * the editor's top bar and tapping it (after confirm) calls onDelete and
   * closes the sheet. Only TeamsScreen wires this - the battle screen and
   * brand-new-mon flows shouldn't expose delete here.
   */
  onDelete?: () => void;
  /** Optional team name shown in the trash confirm body. */
  teamName?: string;
  /**
   * When true, the move picker defaults its "Lowers target" filter on -
   * the user is editing the opponent's mon and is most interested in
   * stat-lowering moves the opponent might use against them.
   */
  isForOpponent?: boolean;
  /**
   * Species already in the same team (excluding THIS slot's current
   * species), forwarded to the SpeciesPicker so the user can't tap a
   * duplicate. Omit for non-team-member edits (the opponent panel,
   * brand-new mons in flows that don't have a team context).
   */
  excludeSpecies?: ReadonlySet<string>;
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
    try {
      action();
    } finally {
      // Microtask reset is enough - the click event after pointerup is
      // dispatched in the same task and would observe firedRef===true.
      setTimeout(() => {
        firedRef.current = false;
      }, 250);
    }
  }
  return {
    onClick: () => fire(),
    onPointerUp: () => fire(),
  };
}

export function MonEditor({ open, initial, onClose, onSave, onDelete, teamName, isForOpponent, excludeSpecies }: Props) {
  const [draft, setDraft] = useState<SavedMon>(initial);
  useEffect(() => setDraft(initial), [initial]);

  const [picker, setPicker] = useState<'species' | 'item' | 'ability' | 'nature' | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  // Detail-sheet target for read-only ability descriptions (Mega ability
  // hint below the Ability field uses this).
  const [abilityDetailName, setAbilityDetailName] = useState<string | null>(null);
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
    const ok = await confirm(`${draft.species} will be removed${where}.`, { title: 'Remove from team?', danger: true, okLabel: 'Remove' });
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
    setDraft((prev) => {
      const next = { ...prev, ...p };
      // Any change to fields backed by a curated build clears buildName.
      if ('item' in p || 'ability' in p || 'nature' in p || 'sps' in p || 'moves' in p) {
        if (p.buildName === undefined) next.buildName = undefined;
      }
      return next;
    });
  }

  // Returns true when the current draft has no user-authored stats/moves -
  // either it's still bound to a curated build (`buildName` set) or every
  // editable field is at its default. Used to decide whether picking a new
  // species can silently auto-apply the recommended build.
  function isDraftUntouched(d: SavedMon): boolean {
    if (d.buildName) return true;
    const noSps = Object.values(d.sps).every((v) => !v);
    const noMoves = d.moves.every((m) => !m);
    const noItem = !d.item;
    const noAbility = !d.ability;
    const defaultNature = d.nature === 'Hardy';
    return noSps && noMoves && noItem && noAbility && defaultNature;
  }

  function applyFirstBuild(species: string, fallback: SavedMon): SavedMon {
    const buildNames = getBuildsForSpecies(species);
    if (buildNames.length === 0) return fallback;
    const built = monFromBuild(species, buildNames[0]);
    if (!built) return fallback;
    return {
      ...fallback,
      buildName: buildNames[0],
      item: built.item,
      ability: built.ability,
      nature: built.nature,
      sps: built.sps,
      moves: built.moves,
    };
  }

  function handleSpeciesPick(species: string) {
    if (draft.species === species) return;
    const base: SavedMon = { ...draft, species, mega: '' };
    // For opponent edits, always auto-apply a curated build on species
    // switch. Opponents are typically what-if probes rather than carefully
    // tuned configs, so the user expects a sensible default rather than
    // partial preservation of the previous build's fields.
    if (isForOpponent || isDraftUntouched(draft)) {
      const withCurated = applyFirstBuild(species, base);
      setDraft(withCurated);
      // No curated build in setdex (e.g. Floette-Eternal) → applyFirstBuild
      // returns the base mon unchanged. Fall back to async synthesis so the
      // user lands on a usable mon instead of a blank slate. Guarded by
      // species match in case the user picks again before synth resolves.
      if (!withCurated.buildName) {
        void synthesizeBuild(species).then((built) => {
          if (!built) return;
          setDraft((d) => {
            if (d.species !== species) return d;
            return {
              ...d,
              buildName: 'Auto · Max-Speed Sweeper',
              ability: built.ability,
              nature: built.nature,
              sps: built.sps,
              moves: built.moves,
            };
          });
        });
      }
      return;
    }
    // Team-mon path with manual edits: keep them but offer the suggested
    // build via a single toast keyed by species so repeated picks don't
    // pile up.
    const buildNames = getBuildsForSpecies(species);
    base.buildName = undefined;
    setDraft(base);
    if (buildNames.length > 0) {
      toast(`Switched to ${species}. Apply suggested build?`, {
        id: `mon-species-suggest-${species}`,
        action: {
          label: 'Apply',
          onClick: () => {
            const built = monFromBuild(species, buildNames[0]);
            if (!built) return;
            setDraft((d) => ({
              ...d,
              species,
              buildName: buildNames[0],
              item: built.item,
              ability: built.ability,
              nature: built.nature,
              sps: built.sps,
              moves: built.moves,
              mega: '',
            }));
          },
        },
      });
    }
  }

  return (
    <div className="fixed inset-0 z-30 bg-black/60 flex items-end md:items-center md:justify-end" onClick={onClose}>
      <div
        className="w-full md:w-[420px] md:h-screen bg-bg-base bg-panel-gradient border border-surface-hi rounded-t-card md:rounded-none max-h-[90vh] md:max-h-screen flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center px-4 pt-4 mb-3 shrink-0">
          {/* Left cluster: back arrow + "Edit" label as one group so the
              header reads as `← Edit | actions` rather than centering the
              title. */}
          <div className="flex items-center">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close editor"
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'rgba(255,255,255,0.15)' }}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center text-lg opacity-70 select-none cursor-pointer"
            >
              ←
            </button>
            <span className="font-bold">Edit</span>
          </div>
          <div className="flex items-center gap-1">
            {copied && (
              <span data-testid="copy-confirmation" className="text-ok text-sm font-semibold mr-1" aria-live="polite">
                ✓ Copied
              </span>
            )}
            <button
              type="button"
              aria-label="Copy Pokémon to clipboard"
              {...copyHandlers}
              data-testid="copy-mon"
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'rgba(124,92,255,0.25)' }}
              className={`min-h-[44px] px-2.5 flex items-center justify-center gap-1.5 rounded-lg select-none cursor-pointer ${copied ? 'bg-ok/20' : 'bg-surface border border-surface-hi'}`}
            >
              <span className="text-base" style={{ pointerEvents: 'none' }}>📋</span>
              <span className="text-xs font-semibold" style={{ pointerEvents: 'none' }}>Copy</span>
            </button>
            <button
              type="button"
              aria-label="Paste from Showdown"
              onClick={() => setImportOpen(true)}
              data-testid="paste-mon"
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'rgba(124,92,255,0.25)' }}
              className="min-h-[44px] px-2.5 flex items-center justify-center gap-1.5 rounded-lg select-none cursor-pointer bg-surface border border-surface-hi"
            >
              <span className="text-base" style={{ pointerEvents: 'none' }}>📥</span>
              <span className="text-xs font-semibold" style={{ pointerEvents: 'none' }}>Paste</span>
            </button>
            {onDelete ? (
              <button
                type="button"
                aria-label="Remove from team"
                {...deleteHandlers}
                data-testid="delete-mon"
                style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'rgba(255,107,107,0.3)' }}
                className="min-h-[44px] px-2.5 flex items-center justify-center gap-1.5 rounded-lg bg-danger/10 border border-danger/30 text-danger select-none cursor-pointer"
              >
                <span className="text-base" style={{ pointerEvents: 'none' }}>🗑</span>
                <span className="text-xs font-semibold" style={{ pointerEvents: 'none' }}>Delete</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* Scrollable body. Save lives outside this so it stays visible while
            the user scrolls through SP grid / moves / effective stats. */}
        <div className="flex-1 overflow-y-auto px-4 [overscroll-behavior:contain]">

        {/* Hero — three-column layout matching MonCard: sprite | name+types
            stack | Mega toggle. items-center vertically centers across the
            row so the toggle sits to the right of the species block rather
            than stacking under it. */}
        <div className="flex gap-3 items-center mb-4 p-3 bg-danger/10 border border-danger/20 rounded-card">
          <button onClick={() => setPicker('species')}>
            <Sprite species={draft.mega ? megaFormeName(draft.species, draft.mega) : draft.species} className="w-16 h-16 rounded" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="font-extrabold text-lg cursor-pointer truncate" onClick={() => setPicker('species')}>
              {draft.species}
            </div>
            <div className="flex gap-1 mt-1">
              {types.map((t) => (
                <TypeBadge key={t} type={t as string} />
              ))}
            </div>
          </div>
          <div className="shrink-0">
            <MegaToggle mega={draft.mega} species={draft.species} item={draft.item} onChange={(mega) => patch({ mega })} />
          </div>
        </div>

        {/* Build dropdown */}
        <div className="mb-3">
          <div className="text-xxs uppercase tracking-wider opacity-55 mb-1">Build</div>
          <BuildDropdown
            species={draft.species}
            selectedName={draft.buildName}
            onApply={(p, name) => setDraft((d) => ({ ...d, ...p, buildName: name }))}
          />
        </div>

        {/* Item / Ability / Nature */}
        <Field label="Item" value={draft.item ?? '- none -'} onClick={() => setPicker('item')} />
        <Field label="Ability" value={draft.ability ?? '- none -'} onClick={() => setPicker('ability')} />
        {(() => {
          // If the held item is a mega stone for this species, surface the
          // ability the mon will switch to on mega-evolution when it differs
          // from the base. Lets the user see e.g. "Mega: Tough Claws" while
          // looking at Charizard's base ability of Blaze.
          const forme = megaFormeFromItem(draft.species, draft.item);
          if (!forme) return null;
          const sp = GEN.species.get(toID(forme) as any);
          const megaAb = sp?.abilities ? (Object.values(sp.abilities)[0] as string | undefined) : undefined;
          if (!megaAb || megaAb === draft.ability) return null;
          return (
            <button
              type="button"
              onClick={() => setAbilityDetailName(megaAb)}
              data-testid="mega-ability-hint"
              aria-label={`${megaAb} details`}
              className="-mt-1 mb-2 px-1 text-[10px] opacity-70 italic flex items-center gap-1 hover:opacity-100"
            >
              <span>✦ Mega:</span>
              <span className="font-semibold not-italic underline decoration-dotted underline-offset-2">{megaAb}</span>
              <span aria-hidden className="opacity-60">→</span>
            </button>
          );
        })()}
        <Field label="Nature" value={draft.nature} onClick={() => setPicker('nature')} />

        {/* SP grid */}
        <div className="my-6">
          <SpGrid sps={draft.sps} onChange={(sps) => patch({ sps })} />
        </div>

        {/* Effective stats - also shows the post-mega column when item is a mega stone */}
        <div className="mb-6">
          <EffectiveStats species={draft.species} nature={draft.nature} sps={draft.sps} item={draft.item} />
        </div>

        {/* Moves */}
        <div className="mb-6">
          <div className="text-xxs uppercase tracking-wider opacity-55 mb-1">Moves</div>
          <MoveSlots species={draft.species} moves={draft.moves} isForOpponent={isForOpponent} onChange={(moves) => patch({ moves })} />
        </div>

        </div>

        {/* Sticky Save footer. Lives outside the scroll body so it's always
            on screen no matter how far down the user has scrolled. iOS
            safe-area-bottom padding keeps it above the home indicator. */}
        <div
          className="shrink-0 px-4 pt-3 pb-[calc(1rem+var(--safe-bottom,0px))] border-t border-surface-hi bg-bg-base"
        >
          <button
            disabled={!valid}
            onClick={() => onSave(draft)}
            className={`w-full py-3 rounded-card font-bold text-base ${valid ? 'bg-accent-gradient text-white' : 'bg-white/10 text-white/40 cursor-not-allowed'}`}
          >
            Save
          </button>
        </div>

        <SpeciesPicker
          open={picker === 'species'}
          onClose={() => setPicker(null)}
          showRecents={false}
          excludeSpecies={excludeSpecies}
          onPick={handleSpeciesPick}
        />
        <ItemPicker open={picker === 'item'} species={draft.species} onClose={() => setPicker(null)} onPick={(item) => patch({ item })} />
        <AbilityPicker
          open={picker === 'ability'}
          species={draft.species}
          currentAbility={draft.ability}
          onClose={() => setPicker(null)}
          onPick={(ability) => patch({ ability })}
        />
        <NaturePicker open={picker === 'nature'} onClose={() => setPicker(null)} onPick={(nature) => patch({ nature })} />
        <AbilityDetailSheet open={abilityDetailName !== null} abilityName={abilityDetailName} onClose={() => setAbilityDetailName(null)} />
        <ShowdownImportDialog
          mode="slot"
          open={importOpen}
          excludeSpecies={excludeSpecies}
          onClose={() => setImportOpen(false)}
          onPick={(parsedDraft) => {
            // Keep the existing slot's id so Save replaces this slot in place;
            // clear buildName because pasted data isn't a curated build.
            setDraft({ id: draft.id, ...parsedDraft, buildName: undefined });
          }}
        />
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
        <span>{value}</span>
        <span className="opacity-40">▾</span>
      </button>
    </div>
  );
}
