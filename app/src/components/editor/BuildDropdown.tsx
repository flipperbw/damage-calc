import { useState } from 'react';
import { getBuildsForSpecies, getBuild } from '../../data/setdex-champions';
import type { SavedMon } from '../../types';

interface Props {
  species: string;
  selectedName?: string;
  onApply: (patch: Partial<SavedMon>, buildName: string) => void;
}

export function BuildDropdown({ species, selectedName, onApply }: Props) {
  const builds = getBuildsForSpecies(species);
  const [open, setOpen] = useState(false);

  function pick(name: string) {
    const b = getBuild(species, name);
    if (!b) return;
    onApply({
      buildName: name,
      item: b.item,
      ability: b.ability,
      nature: b.nature,
      sps: b.sps,
      moves: [b.moves[0] ?? '', b.moves[1] ?? '', b.moves[2] ?? '', b.moves[3] ?? ''] as any,
    }, name);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
              className="w-full bg-accent/10 border border-accent/30 rounded-lg px-3 py-2.5 text-sm flex justify-between items-center text-accent">
        <span>{selectedName ?? 'Custom'}</span>
        <span className="opacity-60">{builds.length} builds ▾</span>
      </button>
      {open && (
        <div className="absolute z-10 left-0 right-0 mt-1 bg-bg-base bg-panel-gradient border border-surface-hi rounded-lg max-h-64 overflow-y-auto p-1.5">
          {builds.length === 0
            ? <div className="px-2 py-2 text-xs opacity-60">No curated builds for {species}</div>
            : builds.map(name => (
              <button key={name} onClick={() => pick(name)}
                      className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-surface">
                {name}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
