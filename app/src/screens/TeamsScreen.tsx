import { useState } from 'react';
import { toast } from 'sonner';

import { ActionMenu } from '@/components/ActionMenu';
import { useConfirm, usePrompt } from '@/components/ConfirmDialog';
import { MonEditor } from '@/components/editor/MonEditor';
import { SpeciesPicker } from '@/components/pickers/SpeciesPicker';
import { ShowdownImportDialog } from '@/components/ShowdownImportDialog';
import { spriteUrl } from '@/data/sprites';
import { useStore } from '@/store';
import { teamToShowdownText } from '@/store/exporters';
import { defaultTeamMon } from '@/store/factories';
import { applySynthIfMissing } from '@/store/synthesize';
import type { SavedMon, Team } from '@/types';
import { copyToClipboard } from '@/util/clipboard';

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
  const recents = useStore((s) => s.recentOpponents);
  const clearRecent = useStore((s) => s.clearRecent);

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

  return (
    <>
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
        />
      ))}

      {teams.length === 0 && (
        <button
          type="button"
          onClick={handleCreateTeam}
          data-testid="create-team-empty"
          style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'rgba(124,92,255,0.15)' }}
          className="w-full text-center mt-6 py-6 rounded-card border border-dashed border-accent/30 text-text-mute select-none cursor-pointer"
        >
          No teams yet. <span className="text-accent font-semibold">Tap to create your first team.</span>
        </button>
      )}

      {recents.length > 0 && (
        <div className="mt-6">
          <div className="text-xxs uppercase tracking-wider opacity-50 px-1 mb-2">Recent opponents</div>
          <div className="rounded-card border border-surface-hi divide-y divide-surface-hi overflow-hidden">
            {recents.map((r) => (
              <div
                key={r.id}
                data-testid={`recent-${r.mon.species}`}
                data-use-count={r.useCount}
                className="flex items-center gap-2.5 px-3 py-2 hover:bg-white/[0.02]"
              >
                <img src={spriteUrl(r.mon.species)} className="w-8 h-8 rounded" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{r.mon.species}</div>
                  <div className="text-[10px] opacity-50 truncate">
                    {r.mon.buildName ?? 'Custom'} · {r.useCount} battles
                  </div>
                </div>
                <button
                  onClick={() => clearRecent(r.id)}
                  aria-label={`Remove ${r.mon.species} from recents`}
                  className="w-7 h-7 flex items-center justify-center rounded text-text-mute hover:text-danger hover:bg-danger/10"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

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
            setEditor({ kind: 'team-mon', teamId: picker.teamId, monId: mon.id });
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
}: {
  team: Team;
  active: boolean;
  onActivate: () => void;
  onSlot: (i: number) => void;
  onMenu: () => void;
}) {
  const slots: (SavedMon | null)[] = [...team.mons, ...Array<null>(6 - team.mons.length).fill(null)];
  return (
    <div
      className={`bg-surface border rounded-card p-3 mb-2.5 ${active ? 'border-accent shadow-[0_0_24px_rgba(124,92,255,0.25)]' : 'border-surface-hi'}`}
    >
      <div className="flex justify-between items-center">
        <button onClick={onActivate} className="text-left flex-1">
          <div className="font-bold text-[15px]">{team.name}</div>
          <div className="text-[11px] opacity-55">
            {team.format === 'singles' ? 'Singles' : 'Doubles'} · last edited {new Date(team.updatedAt).toLocaleDateString()}
          </div>
        </button>
        <button
          onClick={onMenu}
          aria-label="Team actions"
          className="min-w-[36px] min-h-[36px] px-2.5 rounded-lg bg-surface border border-surface-hi text-base leading-none opacity-70 hover:opacity-100"
        >
          ⋮
        </button>
      </div>
      <div className="flex gap-1.5 mt-2.5">
        {slots.map((mon, i) => (
          <button
            key={i}
            onClick={() => onSlot(i)}
            data-testid={mon ? `team-slot-filled-${i}` : `team-slot-empty-${i}`}
            aria-label={mon ? `Edit ${mon.species}` : `Add Pokémon to slot ${i + 1}`}
            className="flex-1 aspect-square bg-surface border border-surface-hi rounded-lg flex items-center justify-center"
          >
            {mon ? <img src={spriteUrl(mon.species)} className="w-3/4 h-3/4 object-contain" /> : <span className="opacity-30 text-xs">＋</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
