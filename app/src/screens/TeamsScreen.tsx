import { useState } from 'react';
import { useStore } from '../store';
import { spriteUrl } from '../data/sprites';
import { MonEditor } from '../components/editor/MonEditor';
import { SpeciesPicker } from '../components/pickers/SpeciesPicker';
import { PickerShell } from '../components/pickers/PickerShell';
import { emptyMon } from '../store/factories';
import { teamToShowdownText } from '../store/exporters';
import type { SavedMon, Team } from '../types';

export function TeamsScreen() {
  const teams = useStore(s => s.teams);
  const activeId = useStore(s => s.activeTeamId);
  const createTeam = useStore(s => s.createTeam);
  const setActiveTeam = useStore(s => s.setActiveTeam);
  const upsertMon = useStore(s => s.upsertMon);
  const renameTeam = useStore(s => s.renameTeam);
  const duplicateTeam = useStore(s => s.duplicateTeam);
  const deleteTeam = useStore(s => s.deleteTeam);
  const recents = useStore(s => s.recentOpponents);
  const clearRecent = useStore(s => s.clearRecent);

  const [picker, setPicker] = useState<{ teamId: string; slotIndex: number } | null>(null);
  const [editor, setEditor] = useState<{ teamId: string; mon: SavedMon } | null>(null);
  const [menuTeamId, setMenuTeamId] = useState<string | null>(null);

  function handleRename(team: Team) {
    const next = window.prompt('Rename team', team.name);
    if (next && next.trim() && next.trim() !== team.name) {
      renameTeam(team.id, next.trim());
    }
  }

  function handleDuplicate(team: Team) {
    duplicateTeam(team.id);
  }

  function handleDelete(team: Team) {
    if (window.confirm(`Delete "${team.name}"? This cannot be undone.`)) {
      deleteTeam(team.id);
    }
  }

  async function handleExport(team: Team) {
    const text = teamToShowdownText(team);
    try {
      await navigator.clipboard.writeText(text);
      window.alert('Team copied to clipboard.');
    } catch {
      // Fallback: show in a prompt for manual copy.
      window.prompt('Copy this team text:', text);
    }
  }

  const menuTeam = menuTeamId ? teams.find(t => t.id === menuTeamId) : null;

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Teams</h2>
        <button onClick={() => createTeam({ name: 'New team', format: 'singles' })}
                className="w-8 h-8 rounded-full bg-surface border border-surface-hi">⊕</button>
      </div>

      {teams.map(t => (
        <TeamCard
          key={t.id}
          team={t}
          active={t.id === activeId}
          onActivate={() => { setActiveTeam(t.id); useStore.getState().setTab('battle'); }}
          onMenu={() => setMenuTeamId(t.id)}
          onSlot={(i) => {
            const mon = t.mons[i];
            if (mon) setEditor({ teamId: t.id, mon });
            else setPicker({ teamId: t.id, slotIndex: i });
          }}
        />
      ))}

      {teams.length === 0 && (
        <div className="text-center mt-10 opacity-70">No teams yet — tap ⊕ to create one.</div>
      )}

      {recents.length > 0 && (
        <div className="mt-6">
          <div className="text-xxs uppercase tracking-wider opacity-50 px-1 mb-2">Recent opponents</div>
          {recents.map(r => (
            <div key={r.id} className="flex items-center gap-2.5 px-2.5 py-2 bg-surface/60 border border-surface-hi rounded-lg mb-1.5">
              <img src={spriteUrl(r.mon.species)} className="w-8 h-8 rounded" />
              <div className="flex-1">
                <div className="font-semibold">{r.mon.species}</div>
                <div className="text-[10px] opacity-50">{r.mon.buildName ?? 'Custom'} · {r.useCount} battles</div>
              </div>
              <button onClick={() => clearRecent(r.id)} className="opacity-50">×</button>
            </div>
          ))}
        </div>
      )}

      {picker && <SpeciesPicker
        open onClose={() => setPicker(null)} showRecents={false}
        onPick={species => {
          const mon = emptyMon(species);
          upsertMon(picker.teamId, mon);
          setPicker(null);
          setEditor({ teamId: picker.teamId, mon });
        }} />}

      {editor && <MonEditor
        open initial={editor.mon}
        onClose={() => setEditor(null)}
        onSave={mon => { upsertMon(editor.teamId, mon); setEditor(null); }}
      />}

      <PickerShell
        open={!!menuTeam}
        onClose={() => setMenuTeamId(null)}
        title={menuTeam?.name}
      >
        {menuTeam && (
          <div className="flex flex-col gap-1.5">
            <MenuButton onClick={() => { setMenuTeamId(null); handleRename(menuTeam); }}>Rename</MenuButton>
            <MenuButton onClick={() => { setMenuTeamId(null); handleDuplicate(menuTeam); }}>Duplicate</MenuButton>
            <MenuButton onClick={() => { setMenuTeamId(null); handleExport(menuTeam); }}>Export (text)</MenuButton>
            <MenuButton tone="danger" onClick={() => { setMenuTeamId(null); handleDelete(menuTeam); }}>Delete</MenuButton>
          </div>
        )}
      </PickerShell>
    </>
  );
}

function MenuButton({ onClick, tone, children }: {
  onClick: () => void; tone?: 'danger'; children: React.ReactNode;
}) {
  const cls = tone === 'danger'
    ? 'bg-danger/10 border-danger/30 text-danger'
    : 'bg-surface border-surface-hi';
  return (
    <button
      onClick={onClick}
      className={`text-left px-3 py-2 rounded-lg border text-sm ${cls}`}
    >
      {children}
    </button>
  );
}

function TeamCard({ team, active, onActivate, onSlot, onMenu }: {
  team: Team; active: boolean;
  onActivate: () => void; onSlot: (i: number) => void; onMenu: () => void;
}) {
  const slots: (SavedMon | null)[] = [
    ...team.mons,
    ...Array<null>(6 - team.mons.length).fill(null),
  ];
  return (
    <div className={`bg-surface border rounded-card p-3 mb-2.5 ${active ? 'border-accent shadow-[0_0_24px_rgba(124,92,255,0.25)]' : 'border-surface-hi'}`}>
      <div className="flex justify-between items-center">
        <button onClick={onActivate} className="text-left flex-1">
          <div className="font-bold text-[15px]">{team.name}</div>
          <div className="text-[11px] opacity-55">
            {team.format === 'singles' ? 'Singles' : 'Doubles'} · last edited {new Date(team.updatedAt).toLocaleDateString()}
          </div>
        </button>
        <button
          onClick={onMenu}
          aria-label="Team menu"
          className="w-8 h-8 rounded-lg bg-surface border border-surface-hi text-base opacity-70 hover:opacity-100"
        >⋯</button>
      </div>
      <div className="flex gap-1.5 mt-2.5">
        {slots.map((mon, i) => (
          <button key={i} onClick={() => onSlot(i)}
                  className="flex-1 aspect-square bg-surface border border-surface-hi rounded-lg flex items-center justify-center">
            {mon ? <img src={spriteUrl(mon.species)} className="w-3/4 h-3/4 object-contain" />
                 : <span className="opacity-30 text-xs">＋</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
