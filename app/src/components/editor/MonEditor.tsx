import { useState, useEffect } from 'react';
import type { SavedMon } from '../../types';
import { spriteUrl } from '../../data/sprites';
import { SpeciesPicker } from '../pickers/SpeciesPicker';
import { ItemPicker } from '../pickers/ItemPicker';
import { AbilityPicker } from '../pickers/AbilityPicker';
import { NaturePicker } from '../pickers/NaturePicker';
import { BuildDropdown } from './BuildDropdown';
import { SpGrid } from './SpGrid';
import { MoveSlots } from './MoveSlots';
import { MegaToggle } from '../MegaToggle';
import { TypeBadge } from '../TypeBadge';
import { Generations } from '@smogon/calc';
import { validateSps } from '../../store/validators';

const GEN = Generations.get(0);

interface Props {
  open: boolean;
  initial: SavedMon;
  onClose: () => void;
  onSave: (mon: SavedMon) => void;
}

export function MonEditor({ open, initial, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<SavedMon>(initial);
  useEffect(() => setDraft(initial), [initial]);

  const [picker, setPicker] = useState<'species' | 'item' | 'ability' | 'nature' | null>(null);

  if (!open) return null;

  const speciesData = GEN.species.get(draft.species as any);
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
          <button onClick={onClose} className="opacity-60">←</button>
          <span className="font-bold">Edit Pokémon</span>
          <span className="w-4" />
        </div>

        {/* Hero */}
        <div className="flex gap-3 items-center mb-4 p-3 bg-danger/10 border border-danger/20 rounded-card">
          <button onClick={() => setPicker('species')}>
            <img src={spriteUrl(draft.species)} className="w-16 h-16 rounded" />
          </button>
          <div className="flex-1">
            <div className="font-extrabold text-lg cursor-pointer" onClick={() => setPicker('species')}>{draft.species}</div>
            <div className="flex gap-1 mt-1">{types.map(t => <TypeBadge key={t} type={t as string} />)}</div>
            <div className="mt-2"><MegaToggle isMega={draft.isMega} species={draft.species}
                                              onChange={isMega => patch({ isMega })} /></div>
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

        {/* Moves */}
        <div className="mb-4">
          <div className="text-xxs uppercase tracking-wider opacity-55 mb-1">Moves</div>
          <MoveSlots moves={draft.moves} onChange={moves => patch({ moves })} />
        </div>

        {/* Save */}
        <button disabled={!valid} onClick={() => onSave(draft)}
                className={`w-full py-3 rounded-card font-bold text-base ${valid ? 'bg-accent-gradient text-white' : 'bg-white/10 text-white/40 cursor-not-allowed'}`}>
          Save
        </button>

        <SpeciesPicker open={picker === 'species'} onClose={() => setPicker(null)}
                       showRecents={false} onPick={s => patch({ species: s })} />
        <ItemPicker open={picker === 'item'} onClose={() => setPicker(null)}
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
      <button onClick={onClick} className="w-full bg-surface border border-surface-hi rounded-lg px-3 py-2 text-sm flex justify-between items-center">
        <span>{value}</span><span className="opacity-40">▾</span>
      </button>
    </div>
  );
}
