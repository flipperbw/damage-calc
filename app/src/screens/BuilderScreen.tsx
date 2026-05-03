import { useEffect, useState } from 'react';

import { CoverageSection } from '@/components/builder/CoverageSection';
import { MatchupMatrix } from '@/components/builder/MatchupMatrix';
import { SuggestionsSection } from '@/components/builder/SuggestionsSection';
import { ThreatListPicker } from '@/components/builder/ThreatListPicker';
import { MonEditor } from '@/components/editor/MonEditor';
import { useStore } from '@/store';

export function BuilderScreen() {
  const teams = useStore((s) => s.teams);
  const threatLists = useStore((s) => s.threatLists);
  const activeTeamId = useStore((s) => s.activeTeamId);
  const upsertThreatMon = useStore((s) => s.upsertThreatMon);
  const removeThreatMon = useStore((s) => s.removeThreatMon);
  const upsertMon = useStore((s) => s.upsertMon);
  const removeMon = useStore((s) => s.removeMon);
  const ensureSeedThreatLists = useStore((s) => s.ensureSeedThreatLists);

  const editor = useStore((s) => s.editor);
  const setEditor = useStore((s) => s.setEditor);

  // Backfill the curated threat lists for users whose persisted state somehow
  // ended up at v4 with an empty threatLists slice (early build of stage 1
  // with the seed throw, a manual reset, an aborted migration, etc.). Idempotent
  // - the action no-ops when the slice is non-empty.
  useEffect(() => {
    ensureSeedThreatLists();
  }, [ensureSeedThreatLists]);

  // The team that drives Coverage / Suggestions / Matrix. Defaults to the
  // user's active team; falls back to the first team if there is no active.
  // Lives in component state (not the store) so navigating away and back
  // resets to the active team - this is a builder workspace, not a separate
  // persisted "what team is the builder thinking about" pointer.
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(activeTeamId ?? teams[0]?.id ?? null);
  // Re-sync if the user picks a different active team in Teams while we're
  // mounted. (We don't listen continuously - the screen typically remounts
  // when you switch tabs, and that re-runs the lazy initializer above.)
  useEffect(() => {
    if (selectedTeamId && teams.some((t) => t.id === selectedTeamId)) return;
    setSelectedTeamId(activeTeamId ?? teams[0]?.id ?? null);
  }, [teams, activeTeamId, selectedTeamId]);

  // Threat list driving the matrix. Default to the first seeded list (or the
  // first list overall) so the matrix has something useful to render on
  // first open.
  const [selectedListId, setSelectedListId] = useState<string | null>(threatLists.find((l) => l.isSeed)?.id ?? threatLists[0]?.id ?? null);
  useEffect(() => {
    if (selectedListId && threatLists.some((l) => l.id === selectedListId)) return;
    setSelectedListId(threatLists.find((l) => l.isSeed)?.id ?? threatLists[0]?.id ?? null);
  }, [threatLists, selectedListId]);

  // Resolve the persisted editor target into a live mon. The editor pointer
  // can survive iOS unloading the tab; we re-resolve it on every render so
  // a stale pointer (deleted threat list, removed mon) closes silently.
  const editorThreatMon = (() => {
    if (!editor || editor.kind !== 'threat-mon') return null;
    const list = threatLists.find((l) => l.id === editor.threatListId);
    if (!list) return null;
    const mon = list.mons.find((m) => m.id === editor.monId);
    if (!mon) return null;
    return { list, mon };
  })();

  // The CoverageSection roster lets the user tap into a team mon to edit.
  // Same persisted-target pattern as TeamsScreen / threat-mon above; we
  // resolve here in BuilderScreen so the editor sheet renders inside the
  // Builder tab without a round-trip through Teams.
  const editorTeamMon = (() => {
    if (!editor || editor.kind !== 'team-mon') return null;
    const t = teams.find((x) => x.id === editor.teamId);
    if (!t) return null;
    const mon = t.mons.find((x) => x.id === editor.monId);
    if (!mon) return null;
    return { team: t, mon };
  })();

  const team = teams.find((t) => t.id === selectedTeamId) ?? null;
  const threatList = threatLists.find((l) => l.id === selectedListId) ?? null;

  if (teams.length === 0) {
    return (
      <div className="text-center mt-10 opacity-70">
        <p>
          You haven't built a team yet. Head to <b>Teams</b> and create one, then come back here for coverage analysis and matchups.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[1100px] mx-auto">
      <h2 className="text-xl font-bold mb-4">Builder</h2>

      <CoverageSection selectedTeamId={selectedTeamId} onSelectTeam={setSelectedTeamId} />
      <SuggestionsSection selectedTeamId={selectedTeamId} />
      <ThreatListPicker
        selectedListId={selectedListId}
        onSelectList={(id) => setSelectedListId(id || null)}
        onEditThreatMon={(threatListId, monId) => setEditor({ kind: 'threat-mon', threatListId, monId })}
      />
      <MatchupMatrix team={team} threatList={threatList} />

      {editorThreatMon && (
        <MonEditor
          open
          initial={editorThreatMon.mon}
          teamName={editorThreatMon.list.name}
          onClose={() => setEditor(null)}
          onSave={(mon) => {
            upsertThreatMon(editorThreatMon.list.id, mon);
            setEditor(null);
          }}
          onDelete={() => {
            // removeThreatMon also clears the editor pointer, so we don't
            // need a second setEditor(null) here.
            removeThreatMon(editorThreatMon.list.id, editorThreatMon.mon.id);
          }}
          isForOpponent
        />
      )}

      {editorTeamMon && (
        <MonEditor
          open
          initial={editorTeamMon.mon}
          teamName={editorTeamMon.team.name}
          onClose={() => setEditor(null)}
          onSave={(mon) => {
            upsertMon(editorTeamMon.team.id, mon);
            setEditor(null);
          }}
          onDelete={() => {
            // removeMon clears the editor pointer too.
            removeMon(editorTeamMon.team.id, editorTeamMon.mon.id);
          }}
        />
      )}
    </div>
  );
}

