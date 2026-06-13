import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { GEN, toID } from '@/calc/gen';
import { megaFormeName } from '@/calc/helpers';
import { ActionMenu } from '@/components/ActionMenu';
import { useConfirm, usePrompt } from '@/components/ConfirmDialog';
import { MonEditor } from '@/components/editor/MonEditor';
import { Logo } from '@/components/Logo';
import { SpeciesPicker } from '@/components/pickers/SpeciesPicker';
import { ShowdownImportDialog } from '@/components/ShowdownImportDialog';
import { Sprite } from '@/components/Sprite';
import { TeamMonCard } from '@/components/TeamMonCard';
import { TypeBadge } from '@/components/TypeBadge';
import { PRESET_TEAMS, type PresetTeam } from '@/data/preset-teams';
import { useStore } from '@/store';
import { teamToShowdownText } from '@/store/exporters';
import { defaultTeamMon } from '@/store/factories';
import { applySynthIfMissing } from '@/store/synthesize';
import type { SavedMon, Team } from '@/types';
import { copyToClipboard } from '@/util/clipboard';
import { uuid } from '@/util/uuid';

export function TeamsScreen() {
  const teams = useStore((s) => s.teams);
  const activeId = useStore((s) => s.activeTeamId);
  const createTeam = useStore((s) => s.createTeam);
  const setActiveTeam = useStore((s) => s.setActiveTeam);
  const upsertMon = useStore((s) => s.upsertMon);
  const removeMon = useStore((s) => s.removeMon);
  const renameTeam = useStore((s) => s.renameTeam);
  const setTeamFormat = useStore((s) => s.setTeamFormat);
  const duplicateTeam = useStore((s) => s.duplicateTeam);
  const deleteTeam = useStore((s) => s.deleteTeam);
  const confirm = useConfirm();
  const prompt = usePrompt();

  const [picker, setPicker] = useState<{ teamId: string; slotIndex: number } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  // Editor target lives in the store so it survives iOS unloading the tab.
  // We resolve teamId/monId back to a live SavedMon below; if the target
  // has gone stale (team or mon removed) the editor stays closed.
  const editor = useStore((s) => s.editor);
  const setEditor = useStore((s) => s.setEditor);
  const [menuTeamId, setMenuTeamId] = useState<string | null>(null);

  const editorTeamMon = (() => {
    if (!editor || editor.kind !== 'team-mon') return null;
    const t = teams.find((x) => x.id === editor.teamId);
    if (!t) return null;
    const m = t.mons.find((x) => x.id === editor.monId);
    if (!m) return null;
    return { team: t, mon: m };
  })();

  async function handleRename(team: Team) {
    const next = await prompt('Enter a new team name', {
      title: 'Rename team',
      defaultValue: team.name,
      placeholder: 'Team name',
    });
    if (next && next.trim() && next.trim() !== team.name) {
      renameTeam(team.id, next.trim());
      toast.success('Team renamed');
    }
  }

  function handleDuplicate(team: Team) {
    duplicateTeam(team.id);
    toast.success('Team duplicated');
  }

  async function handleDelete(team: Team) {
    const ok = await confirm(`"${team.name}" will be permanently deleted. This cannot be undone.`, {
      title: 'Delete team?',
      danger: true,
      okLabel: 'Delete',
    });
    if (ok) {
      deleteTeam(team.id);
      toast.success('Team deleted');
    }
  }

  async function handleExport(team: Team) {
    const text = teamToShowdownText(team);
    const ok = await copyToClipboard(text);
    if (ok) {
      toast.success('Team copied to clipboard');
    } else {
      // eslint-disable-next-line no-console
      console.warn('[TeamsScreen] team export copy failed; text was:\n', text);
      toast.error('Could not copy team');
    }
  }

  const menuTeam = menuTeamId ? teams.find((t) => t.id === menuTeamId) : null;

  function handleCreateTeam() {
    createTeam({ name: 'New team', format: 'singles' });
  }

  function handleUsePreset(preset: PresetTeam) {
    const teamId = createTeam({ name: preset.name, format: preset.format });
    for (const m of preset.mons) {
      upsertMon(teamId, { ...m, id: uuid() });
    }
    setActiveTeam(teamId);
    toast.success(`${preset.name} added`);
  }

  return (
    <>
      {teams.length > 0 && (
        <div className="mb-4">
          <h2 className="text-xl font-bold mb-3">Teams</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCreateTeam}
              aria-label="Create team"
              data-testid="create-team"
              // Bare-bones styling - no gradient, no active-scale transform, no
              // backdrop blur. Some iOS browsers (Brave especially) have flaky
              // hit-testing on transformed/blurred elements. touch-action +
              // tap-highlight-color make taps deterministic on WebKit.
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'rgba(255,255,255,0.15)' }}
              className="flex-1 min-h-[52px] py-3 px-4 rounded-card bg-accent text-white text-base font-bold flex items-center justify-center gap-2 select-none cursor-pointer"
            >
              <span className="text-xl leading-none">+</span>
              <span>Create Team</span>
            </button>
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              aria-label="Import team from Showdown"
              data-testid="import-team"
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'rgba(255,255,255,0.15)' }}
              className="min-h-[52px] px-4 rounded-card bg-surface border border-surface-hi text-sm font-semibold select-none cursor-pointer"
            >
              Import
            </button>
          </div>
        </div>
      )}

      {teams.map((t) => (
        <TeamCard
          key={t.id}
          team={t}
          active={t.id === activeId}
          onActivate={() => {
            setActiveTeam(t.id);
            useStore.getState().setTab('battle');
          }}
          onMenu={() => setMenuTeamId(t.id)}
          onSlot={(i) => {
            const mon = t.mons[i];
            if (mon) setEditor({ kind: 'team-mon', teamId: t.id, monId: mon.id });
            else setPicker({ teamId: t.id, slotIndex: i });
          }}
          onOpenMon={(monId) => setEditor({ kind: 'team-mon', teamId: t.id, monId })}
        />
      ))}

      {teams.length === 0 && (
        <EmptyState
          onCreate={handleCreateTeam}
          onImport={() => setImportOpen(true)}
          onUsePreset={handleUsePreset}
        />
      )}

      {teams.length > 0 && <MetaTeamsSection onUsePreset={handleUsePreset} />}

      {picker && (
        <SpeciesPicker
          open
          onClose={() => setPicker(null)}
          showRecents={false}
          // Species Clause: hide whichever species are already in this team.
          excludeSpecies={new Set((teams.find((t) => t.id === picker.teamId)?.mons ?? []).map((m) => m.species))}
          onPick={(species) => {
            const mon = defaultTeamMon(species);
            upsertMon(picker.teamId, mon);
            applySynthIfMissing(
              mon,
              () => useStore.getState().teams.find((t) => t.id === picker.teamId)?.mons.find((m) => m.id === mon.id),
              (patched) => upsertMon(picker.teamId, patched),
            );
            setPicker(null);
            // See BattleScreen's add-mon picker: only auto-open the
            // editor for curated builds so un-curated species (e.g.
            // Aegislash-Shield) don't flash an empty profile while the
            // background synth resolves.
            if (mon.buildName) setEditor({ kind: 'team-mon', teamId: picker.teamId, monId: mon.id });
          }}
        />
      )}

      {editorTeamMon && (
        <MonEditor
          open
          initial={editorTeamMon.mon}
          teamName={editorTeamMon.team.name}
          // Other slots in this team — passed through to the editor's species
          // picker so the user can't accidentally pick a duplicate.
          excludeSpecies={new Set(editorTeamMon.team.mons.filter((m) => m.id !== editorTeamMon.mon.id).map((m) => m.species))}
          onClose={() => setEditor(null)}
          onSave={(mon) => {
            upsertMon(editorTeamMon.team.id, mon);
            setEditor(null);
          }}
          onDelete={() => {
            // The confirm now lives inside MonEditor (so iOS doesn't lose the
            // gesture chain through a window.confirm). We just commit the
            // delete here. removeMon also clears the editor pointer.
            removeMon(editorTeamMon.team.id, editorTeamMon.mon.id);
          }}
        />
      )}

      <ShowdownImportDialog mode="team" open={importOpen} onClose={() => setImportOpen(false)} />

      <ActionMenu
        open={!!menuTeam}
        onClose={() => setMenuTeamId(null)}
        title={menuTeam?.name}
        items={
          menuTeam
            ? [
                {
                  label: 'Rename',
                  onClick: () => {
                    setMenuTeamId(null);
                    handleRename(menuTeam);
                  },
                },
                {
                  label: menuTeam.format === 'singles' ? 'Switch to Doubles' : 'Switch to Singles',
                  onClick: () => {
                    setMenuTeamId(null);
                    const next = menuTeam.format === 'singles' ? 'doubles' : 'singles';
                    setTeamFormat(menuTeam.id, next);
                    toast.success(`Format set to ${next === 'singles' ? 'Singles' : 'Doubles'}`);
                  },
                },
                {
                  label: 'Duplicate',
                  onClick: () => {
                    setMenuTeamId(null);
                    handleDuplicate(menuTeam);
                  },
                },
                {
                  label: 'Export (text)',
                  onClick: () => {
                    setMenuTeamId(null);
                    handleExport(menuTeam);
                  },
                },
                {
                  label: 'Delete',
                  tone: 'danger',
                  onClick: () => {
                    setMenuTeamId(null);
                    handleDelete(menuTeam);
                  },
                },
              ]
            : []
        }
      />
    </>
  );
}

function TeamCard({
  team,
  active,
  onActivate,
  onSlot,
  onMenu,
  onOpenMon,
}: {
  team: Team;
  active: boolean;
  onActivate: () => void;
  onSlot: (i: number) => void;
  onMenu: () => void;
  onOpenMon: (monId: string) => void;
}) {
  // Active team starts expanded; inactive teams start collapsed. After
  // mount, manual toggles win until the team becomes active again — the
  // useEffect below re-expands on every active→true transition so when
  // the user activates a different team it auto-opens.
  const [expanded, setExpanded] = useState(active);
  useEffect(() => {
    if (active) setExpanded(true);
  }, [active]);
  const slots: (SavedMon | null)[] = [...team.mons, ...Array<null>(6 - team.mons.length).fill(null)];
  return (
    <div
      className={`bg-surface border rounded-card p-3 mb-2.5 ${active ? 'border-accent shadow-[0_0_24px_rgba(124,92,255,0.25)]' : 'border-surface-hi'}`}
    >
      <div className="flex justify-between items-center">
        <button onClick={onActivate} className="text-left flex-1 min-w-0">
          <div className="font-bold text-[15px] truncate">{team.name}</div>
          <div className="text-[11px] opacity-55">
            {team.format === 'singles' ? 'Singles' : 'Doubles'} · last edited {new Date(team.updatedAt).toLocaleDateString()}
          </div>
        </button>
        <button
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? 'Collapse team details' : 'Expand team details'}
          aria-expanded={expanded}
          data-testid={`team-expand-${team.id}`}
          className="min-w-[36px] min-h-[36px] px-2 rounded-lg bg-surface border border-surface-hi text-sm leading-none opacity-70 hover:opacity-100"
        >
          {expanded ? '▴' : '▾'}
        </button>
        <button
          onClick={onMenu}
          aria-label="Team actions"
          className="min-w-[36px] min-h-[36px] px-2.5 ml-1 rounded-lg bg-surface border border-surface-hi text-base leading-none opacity-70 hover:opacity-100"
        >
          ⋮
        </button>
      </div>
      <div className="flex gap-1.5 mt-2.5 md:gap-2 md:justify-center">
        {slots.map((mon, i) => (
          <TeamSlot key={i} mon={mon} onClick={() => onSlot(i)} testId={mon ? `team-slot-filled-${i}` : `team-slot-empty-${i}`} index={i} />
        ))}
      </div>
      {expanded && team.mons.length > 0 && (
        // Single column on mobile (each card readable at full width); three
        // columns on desktop so a full 6-mon team lays out as 2 rows × 3.
        // Empty slots get a dashed-border placeholder card that opens the
        // species picker — keeps the grid balanced and signals where to add.
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3">
          {team.mons.map((mon) => (
            <TeamMonCard key={mon.id} mon={mon} onEdit={() => onOpenMon(mon.id)} />
          ))}
          {Array.from({ length: 6 - team.mons.length }, (_, k) => {
            const slotIndex = team.mons.length + k;
            return <EmptyMonCard key={`empty-${slotIndex}`} onClick={() => onSlot(slotIndex)} />;
          })}
        </div>
      )}
    </div>
  );
}

function EmptyState({
  onCreate,
  onImport,
  onUsePreset,
}: {
  onCreate: () => void;
  onImport: () => void;
  onUsePreset: (preset: PresetTeam) => void;
}) {
  return (
    <div className="mt-2">
      <div className="flex flex-col items-center text-center px-2 pt-6 pb-4">
        <Logo className="w-16 h-16 mb-3" />
        <p className="text-sm text-text-mute max-w-xs">
          Build a team to start calculating, or pick one of the example teams below.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={onCreate}
          data-testid="create-team-empty"
          style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'rgba(255,255,255,0.15)' }}
          className="flex-1 min-h-[52px] py-3 px-4 rounded-card bg-accent text-white text-base font-bold flex items-center justify-center gap-2 select-none cursor-pointer"
        >
          <span className="text-xl leading-none">+</span>
          <span>Create a team</span>
        </button>
        <button
          type="button"
          onClick={onImport}
          data-testid="import-team-empty"
          style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'rgba(255,255,255,0.15)' }}
          className="flex-1 sm:flex-initial sm:px-5 min-h-[52px] py-3 px-4 rounded-card bg-surface border border-surface-hi text-sm font-semibold select-none cursor-pointer"
        >
          Import from Showdown
        </button>
      </div>

      <div className="flex items-center gap-3 mt-7 mb-3">
        <div className="flex-1 h-px bg-surface-hi" />
        <div className="text-xxs uppercase tracking-wider opacity-55">Or start from a template</div>
        <div className="flex-1 h-px bg-surface-hi" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        {PRESET_TEAMS.map((p) => (
          <PresetCard key={p.name} preset={p} onUse={() => onUsePreset(p)} />
        ))}
      </div>
    </div>
  );
}

function EmptyMonCard({ onClick }: { onClick: () => void }) {
  // Sized to roughly match TeamMonCard's footprint so the grid stays balanced
  // when a team is short of six mons. Dashed border + accent-on-hover signals
  // "tap to fill" without competing with the real cards visually.
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="team-mon-empty-card"
      aria-label="Add Pokémon to this slot"
      className="bg-surface/40 border border-dashed border-surface-hi rounded-card p-3 min-h-[180px] flex flex-col items-center justify-center gap-1.5 text-text-mute hover:border-accent/50 hover:text-accent transition-colors"
    >
      <span className="text-2xl leading-none opacity-60">＋</span>
      <span className="text-[11px] uppercase tracking-wider font-semibold opacity-70">Empty slot</span>
    </button>
  );
}

function TeamSlot({ mon, onClick, testId, index }: { mon: SavedMon | null; onClick: () => void; testId: string; index: number }) {
  // Compact desktop tile: sprite + species + types. Mobile keeps the bare
  // sprite-square — the row needs to fit six tiles across an iPhone-SE.
  const effectiveSpecies = mon?.mega ? megaFormeName(mon.species, mon.mega, mon.item) : mon?.species ?? '';
  const sp = mon ? GEN.species.get(toID(effectiveSpecies) as any) ?? GEN.species.get(toID(mon.species) as any) : undefined;
  const types = (sp?.types ?? []) as string[];
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      aria-label={mon ? `Edit ${mon.species}` : `Add Pokémon to slot ${index + 1}`}
      className={`flex-1 md:flex-none md:w-[140px] md:min-h-[140px] aspect-square md:aspect-auto bg-surface rounded-lg flex flex-col items-center justify-center md:px-2 md:py-2.5 md:gap-1.5 hover:border-accent/40 ${mon ? 'border border-surface-hi' : 'border border-dashed border-surface-hi/70'}`}
    >
      {mon ? (
        <>
          <Sprite species={effectiveSpecies} className="w-3/4 h-3/4 md:w-20 md:h-20" />
          <div className="hidden md:flex flex-col items-center w-full min-w-0">
            <div className="flex items-center gap-1 w-full justify-center">
              <span className="font-semibold text-[12px] truncate">{mon.species}</span>
              {mon.mega && <span className="text-[8px] uppercase tracking-wider text-accent font-bold shrink-0">✦</span>}
            </div>
            <div className="flex gap-1 mt-1">
              {types.map((t) => (
                <TypeBadge key={t} type={t} />
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-1 opacity-40">
          <span className="text-base leading-none">＋</span>
          <span className="hidden md:block text-[10px] uppercase tracking-wider font-semibold">Empty slot</span>
        </div>
      )}
    </button>
  );
}

// Pre-tokenize each preset team into a single searchable lowercase blob.
// `name` already encodes "<tournament> – <author> <record>" and `blurb`
// repeats it, so author + record + tournament come along for free. We also
// fold in every species (with a "mega <name>" alias for mega formes), the
// abilities, and the items so queries like "garchomp", "maddo", "11-0",
// "intimidate", and "sitrus" all hit.
const PRESET_SEARCH_INDEX: { team: PresetTeam; blob: string }[] = PRESET_TEAMS.map((p) => {
  const parts: string[] = [p.name, p.blurb];
  for (const m of p.mons) {
    parts.push(m.species);
    if (m.mega) parts.push(`mega ${m.species}`);
    if (m.ability) parts.push(m.ability);
    if (m.item) parts.push(m.item);
  }
  return { team: p, blob: parts.join(' ').toLowerCase() };
});

function MetaTeamsSection({ onUsePreset }: { onUsePreset: (preset: PresetTeam) => void }) {
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState('');
  const trimmed = query.trim().toLowerCase();
  const filtered = trimmed
    ? PRESET_SEARCH_INDEX.filter((entry) => entry.blob.includes(trimmed)).map((e) => e.team)
    : PRESET_TEAMS;

  return (
    <div className="mt-8 -mx-3 px-3 py-4 border-t border-b border-accent/20 bg-accent/4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        data-testid="meta-teams-toggle"
        className="w-full flex items-center justify-between mb-3 group"
      >
        <span className="flex items-center gap-2">
          <span className="text-accent text-lg leading-none">✦</span>
          <span className="text-sm font-bold uppercase tracking-wider text-accent">Meta teams</span>
          <span className="text-[10px] uppercase tracking-wider opacity-50">
            {trimmed ? `${filtered.length} / ${PRESET_TEAMS.length}` : PRESET_TEAMS.length}
          </span>
        </span>
        <span className="text-accent opacity-70 group-hover:opacity-100">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <>
          <div className="flex items-center gap-2 mb-3">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by species, author, or tournament…"
              aria-label="Filter meta teams"
              data-testid="meta-teams-filter"
              className="flex-1 min-w-0 bg-surface border border-surface-hi rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-mute focus:border-accent/60 outline-none"
            />
            {trimmed && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear filter"
                className="px-2 py-2 rounded-lg bg-surface border border-surface-hi text-xs opacity-70 hover:opacity-100"
              >
                Clear
              </button>
            )}
          </div>
          {filtered.length === 0 ? (
            <p className="text-[12px] opacity-50 px-1 py-3">No teams match "{trimmed}".</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {filtered.map((p) => (
                <PresetCard key={p.name} preset={p} onUse={() => onUsePreset(p)} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PresetCard({ preset, onUse }: { preset: PresetTeam; onUse: () => void }) {
  return (
    <div
      className="bg-surface border border-surface-hi rounded-card p-3 flex flex-col gap-4"
      data-testid={`preset-${preset.name.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div>
        <div className="font-bold text-[15px]">{preset.name}</div>
        <div className="text-[11px] opacity-60 leading-snug">{preset.blurb}</div>
      </div>
      <div className="flex gap-1.5">
        {preset.mons.map((m, i) => (
          <div
            key={i}
            className="flex-1 aspect-square bg-surface border border-surface-hi rounded-lg flex items-center justify-center"
            title={m.species}
          >
            <Sprite species={m.species} className="w-3/4 h-3/4" />
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onUse}
        aria-label={`Use ${preset.name} template`}
        style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'rgba(124,92,255,0.15)' }}
        className="min-h-10 mt-0.5 rounded-lg bg-accent/15 border border-accent/40 text-accent text-sm font-semibold select-none cursor-pointer hover:bg-accent/25"
      >
        Use team
      </button>
    </div>
  );
}
