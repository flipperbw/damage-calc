import { useState } from 'react';
import { getBuildsForSpecies } from '../../data/setdex-champions';
import { monFromBuild } from '../../store/factories';
import { synthesizeBuild, summarizeSynth } from '../../store/synthesize';
import type { SavedMon } from '../../types';

interface Props {
  species: string;
  selectedName?: string;
  onApply: (patch: Partial<SavedMon>, buildName: string) => void;
}

const AUTO_BUILD_NAME = 'Auto · Max-Speed Sweeper';

export function BuildDropdown({ species, selectedName, onApply }: Props) {
  const builds = getBuildsForSpecies(species);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const summary = summarizeSynth(species);

  function pick(name: string) {
    const built = monFromBuild(species, name);
    if (!built) return;
    onApply({
      buildName: name,
      item: built.item,
      ability: built.ability,
      nature: built.nature,
      sps: built.sps,
      moves: built.moves,
    }, name);
    setOpen(false);
  }

  async function pickAuto() {
    if (busy) return;
    setBusy(true);
    try {
      const built = await synthesizeBuild(species);
      if (!built) return;
      onApply({
        buildName: AUTO_BUILD_NAME,
        item: undefined,
        ability: built.ability,
        nature: built.nature,
        sps: built.sps,
        moves: built.moves,
      }, AUTO_BUILD_NAME);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  // Auto-build is always offered, on top of any curated builds.
  const totalCount = builds.length + (summary ? 1 : 0);

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
              className="w-full bg-accent/10 border border-accent/30 rounded-lg px-3 py-2.5 text-sm flex justify-between items-center text-accent">
        <span>{selectedName ?? 'Custom'}</span>
        <span className="opacity-60">{totalCount} builds ▾</span>
      </button>
      {open && (
        <div className="absolute z-10 left-0 right-0 mt-1 bg-bg-base bg-panel-gradient border border-surface-hi rounded-lg max-h-64 overflow-y-auto p-1.5">
          {summary && (
            <button
              onClick={pickAuto}
              disabled={busy}
              data-testid="build-auto"
              className="w-full text-left px-2 py-1.5 rounded text-sm bg-accent/10 hover:bg-accent/20 mb-1 flex justify-between items-center"
            >
              <span className="font-semibold">{busy ? 'Building…' : AUTO_BUILD_NAME}</span>
              <span className="text-[10px] opacity-60">
                {summary.nature} · {summary.bestAtk === 'atk' ? 'Phys' : 'Spec'}{summary.isFast ? ' · fast' : ''}
              </span>
            </button>
          )}
          {builds.length === 0 && !summary && (
            <div className="px-2 py-2 text-xs opacity-60">No builds for {species}</div>
          )}
          {builds.map(name => (
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
