import { useState } from 'react';
import { Generations, toID } from '@smogon/calc';

import { getBuild, getBuildsForSpecies } from '@/data/setdex-champions';
import { monFromBuild } from '@/store/factories';
import { summarizeSynth, synthesizeBuild } from '@/store/synthesize';
import type { SavedMon, StatID } from '@/types';

const GEN = Generations.get(0);

const SETUP_MOVES = new Set(
  [
    'Dragon Dance',
    'Swords Dance',
    'Calm Mind',
    'Nasty Plot',
    'Bulk Up',
    'Quiver Dance',
    'Shell Smash',
    'Shift Gear',
    'Tail Glow',
    'Coil',
    'Hone Claws',
    'Geomancy',
    'Work Up',
  ].map((m) => m.toLowerCase()),
);

const CHOICE_ITEMS = new Set(['choice band', 'choice specs', 'choice scarf']);

interface ChampionsBuildLite {
  ability: string;
  item: string;
  nature: string;
  moves: string[];
  sps: Partial<Record<StatID, number>>;
}

function naturePlusMinus(nature: string): { plus?: StatID; minus?: StatID } {
  const n = GEN.natures.get(toID(nature) as any);
  if (!n) return {};
  return { plus: n.plus as StatID | undefined, minus: n.minus as StatID | undefined };
}

/**
 * Derive a plain-language role label from a curated build. Returns null when
 * no heuristic matches confidently — caller should fall back to the Smogon
 * name only.
 */
function deriveRoleLabel(build: ChampionsBuildLite): string | null {
  const sps = build.sps;
  const moves = build.moves.map((m) => m.toLowerCase());
  const item = (build.item ?? '').toLowerCase();
  const { plus } = naturePlusMinus(build.nature);
  const atkSps = sps.atk ?? 0;
  const spaSps = sps.spa ?? 0;
  const hpSps = sps.hp ?? 0;
  const defSps = sps.def ?? 0;
  const spdSps = sps.spd ?? 0;
  const speSps = sps.spe ?? 0;
  const hasSetup = moves.some((m) => SETUP_MOVES.has(m));
  const isChoice = CHOICE_ITEMS.has(item);
  const isFast = speSps >= 28;
  const maxedAtk = atkSps >= 28 && plus === 'atk';
  const maxedSpa = spaSps >= 28 && plus === 'spa';

  if (isChoice && (maxedAtk || atkSps >= 28) && isFast) return 'Choice Physical Sweeper';
  if (isChoice && (maxedSpa || spaSps >= 28) && isFast) return 'Choice Special Sweeper';
  if ((maxedAtk || maxedSpa) && hasSetup && isFast) return 'Setup Sweeper';
  if (maxedAtk) return 'Physical Attacker';
  if (maxedSpa) return 'Special Attacker';
  if (hpSps >= 28 && (defSps >= 16 || spdSps >= 16)) return defSps >= spdSps ? 'Physical Tank' : 'Special Tank';
  if (hpSps >= 24 && (defSps + spdSps) >= 24) return 'Bulky Pivot';
  return null;
}

interface Props {
  species: string;
  selectedName?: string;
  onApply: (patch: Partial<SavedMon>, buildName: string) => void;
}

const AUTO_BUILD_NAME = 'Auto · Max-Speed Sweeper';
const AUTO_BUILD_PREFIX = 'Auto · ';

export function BuildDropdown({ species, selectedName, onApply }: Props) {
  const builds = getBuildsForSpecies(species);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const summary = summarizeSynth(species);

  function pick(name: string) {
    const built = monFromBuild(species, name);
    if (!built) return;
    onApply(
      {
        buildName: name,
        item: built.item,
        ability: built.ability,
        nature: built.nature,
        sps: built.sps,
        moves: built.moves,
      },
      name,
    );
    setOpen(false);
  }

  async function pickAuto() {
    if (busy) return;
    setBusy(true);
    try {
      const built = await synthesizeBuild(species);
      if (!built) return;
      onApply(
        {
          buildName: AUTO_BUILD_NAME,
          item: undefined,
          ability: built.ability,
          nature: built.nature,
          sps: built.sps,
          moves: built.moves,
        },
        AUTO_BUILD_NAME,
      );
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  // Auto-build is always offered, on top of any curated builds.
  const totalCount = builds.length + (summary ? 1 : 0);

  // Trigger label resolution. Mirrors the curated-row template (role on top,
  // descriptive build name beneath) so the trigger and the dropdown rows
  // share visual structure.
  const triggerLabel = (() => {
    if (!selectedName) return { primary: 'Custom', secondary: undefined };
    if (selectedName.startsWith(AUTO_BUILD_PREFIX)) {
      return { primary: selectedName, secondary: undefined };
    }
    const b = getBuild(species, selectedName);
    const role = b ? deriveRoleLabel(b) : null;
    return role && role !== selectedName
      ? { primary: role, secondary: selectedName }
      : { primary: selectedName, secondary: undefined };
  })();

  return (
    <div className="relative">
      <button
        type="button"
        data-testid="build-trigger"
        onClick={() => setOpen((o) => !o)}
        className="w-full bg-accent/10 border border-accent/30 rounded-lg px-3 py-2 text-sm flex justify-between items-center text-accent"
      >
        <span className="text-left min-w-0 flex-1">
          <span className="font-semibold block truncate">{triggerLabel.primary}</span>
          {triggerLabel.secondary && <span className="text-[11px] opacity-60 italic block truncate">{triggerLabel.secondary}</span>}
        </span>
        <span className="opacity-60 shrink-0 ml-2">{totalCount} builds ▾</span>
      </button>
      {open && (
        <div className="absolute z-10 left-0 right-0 mt-1 bg-bg-base bg-panel-gradient border border-surface-hi rounded-lg max-h-64 overflow-y-auto p-1.5">
          {summary && (
            <button
              onClick={pickAuto}
              disabled={busy}
              data-testid="build-auto"
              className="w-full text-left px-2 py-1.5 rounded text-sm bg-accent/10 hover:bg-accent/20 mb-1"
            >
              <span className="font-semibold">{busy ? 'Building…' : AUTO_BUILD_NAME}</span>
            </button>
          )}
          {builds.length === 0 && !summary && <div className="px-2 py-2 text-xs opacity-60">No builds for {species}</div>}
          {builds.map((name) => {
            const b = getBuild(species, name);
            const role = b ? deriveRoleLabel(b) : null;
            return (
              <button key={name} onClick={() => pick(name)} className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-surface">
                {role ? (
                  <>
                    <div className="font-semibold">{role}</div>
                    <div className="text-[11px] opacity-60 italic">{name}</div>
                  </>
                ) : (
                  <span>{name}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
