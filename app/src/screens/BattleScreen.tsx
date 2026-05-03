import { useMemo, useState } from 'react';

import { calculateMatchup } from '@/calc/adapter';
import { MonEditor } from '@/components/editor/MonEditor';
import { FieldBar } from '@/components/FieldBar';
import { MonCard } from '@/components/MonCard';
import { MoveRow } from '@/components/MoveRow';
import { SpeciesPicker } from '@/components/pickers/SpeciesPicker';
import { SpeedDivider } from '@/components/SpeedDivider';
import { TeamCarousel } from '@/components/TeamCarousel';
import { useStore } from '@/store';
import { defaultOpponentMon, defaultTeamMon } from '@/store/factories';

export function BattleScreen() {
  const team = useStore((s) => s.teams.find((t) => t.id === s.activeTeamId));
  const activeIndex = useStore((s) => s.activeMonIndex);
  const opponent = useStore((s) => s.opponent);
  const setOpponent = useStore((s) => s.setOpponent);
  const updateOpponent = useStore((s) => s.updateOpponent);
  const upsertMon = useStore((s) => s.upsertMon);
  const createTeam = useStore((s) => s.createTeam);
  const setTab = useStore((s) => s.setTab);
  const field = useStore((s) => s.field);
  // Editor target lives in the store so it survives iOS unloading the tab.
  // The editor is rendered for the *current* `you` or `opponent` mon based
  // on the persisted target - losing the WIP draft on reload is the agreed
  // tradeoff (keystroke writes would be too noisy).
  const editor = useStore((s) => s.editor);
  const setEditor = useStore((s) => s.setEditor);

  const [oppPicker, setOppPicker] = useState(false);
  // When set, the species picker is bound to add a new mon to the active team
  // (rather than picking an opponent). Tapping an empty slot in the team
  // carousel routes here.
  const [addMonPicker, setAddMonPicker] = useState(false);

  // Resolve the persisted editor target into the live mon to edit. If the
  // target has gone stale (team deleted, opponent cleared), the resolution
  // returns null and the editor stays closed.
  const editorMon = (() => {
    if (!editor) return null;
    if (editor.kind === 'opponent') return opponent;
    if (editor.kind === 'team-mon' && team && editor.teamId === team.id) {
      return team.mons.find((m) => m.id === editor.monId) ?? null;
    }
    return null;
  })();

  const you = team?.mons[activeIndex];

  // Memo so we don't recompute when unrelated store slices change.
  const matchup = useMemo(() => (you && opponent ? calculateMatchup(you, opponent, field) : null), [you, opponent, field]);

  // Priority-flips-order warning. Fires when:
  // - You outspeed but opponent has a positive-priority move (they hit first), or
  // - You're slower but you have a positive-priority move (you hit first).
  const priorityWarning = useMemo(() => {
    if (!matchup) return undefined;
    const { speed, attackerMoves, defenderMoves } = matchup;
    if (speed.attackerOutspeeds) {
      const oppPrio = defenderMoves.find((m) => m.priority > 0 && m.moveName);
      if (oppPrio) return `${oppPrio.moveName} flips order`;
    } else if (speed.delta < 0) {
      const yourPrio = attackerMoves.find((m) => m.priority > 0 && m.moveName);
      if (yourPrio) return `${yourPrio.moveName} flips order`;
    }
    return undefined;
  }, [matchup]);

  if (!team) {
    return (
      <div className="max-w-[520px] mx-auto mt-10 md:mt-20 px-4">
        <div className="bg-surface border border-surface-hi rounded-card p-6 text-center" data-testid="battle-empty-state">
          <h2 className="text-lg font-bold mb-1">No team yet</h2>
          <p className="text-sm opacity-70 mb-5">Create a team to start calculating damage.</p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <button
              type="button"
              data-testid="battle-empty-create-team"
              onClick={() => createTeam({ name: 'New team', format: 'singles' })}
              className="px-4 py-2.5 rounded-lg bg-accent-gradient text-white text-sm font-bold"
            >
              Create your first team
            </button>
            <button
              type="button"
              data-testid="battle-empty-browse-teams"
              onClick={() => setTab('teams')}
              className="px-4 py-2.5 rounded-lg bg-surface border border-surface-hi text-sm font-semibold"
            >
              Browse teams
            </button>
          </div>
        </div>
      </div>
    );
  }
  if (!you || !opponent || !matchup) {
    return (
      <div className="max-w-[1100px] mx-auto">
        <FieldBar />
        <TeamCarousel onAddMon={() => setAddMonPicker(true)} />
        {you ? (
          <button
            onClick={() => setOppPicker(true)}
            data-testid="pick-opponent"
            className="w-full bg-surface border border-dashed border-danger/25 rounded-card p-6 text-center text-sm opacity-70 hover:opacity-100"
          >
            Tap to pick an opponent
          </button>
        ) : (
          <div
            className="bg-surface border border-surface-hi rounded-card p-6 text-center"
            data-testid="add-mon-prompt"
          >
            <h3 className="text-base font-bold mb-1">This team is empty</h3>
            <p className="text-sm opacity-70 mb-4">Add a Pokémon to start calculating damage.</p>
            <button
              type="button"
              data-testid="add-first-mon"
              onClick={() => setAddMonPicker(true)}
              className="px-4 py-2.5 rounded-lg bg-accent-gradient text-white text-sm font-bold"
            >
              Add your first Pokémon
            </button>
          </div>
        )}
        <SpeciesPicker open={oppPicker} onClose={() => setOppPicker(false)} onPick={(s) => setOpponent(defaultOpponentMon(s))} />
        <SpeciesPicker
          open={addMonPicker}
          onClose={() => setAddMonPicker(false)}
          showRecents={false}
          onPick={(species) => {
            const mon = defaultTeamMon(species);
            upsertMon(team.id, mon);
            setAddMonPicker(false);
            setEditor({ kind: 'team-mon', teamId: team.id, monId: mon.id });
          }}
        />
        {editor && editorMon && (
          <MonEditor
            open
            initial={editorMon}
            isForOpponent={editor.kind === 'opponent'}
            onClose={() => setEditor(null)}
            onSave={(mon) => {
              if (editor.kind === 'team-mon') upsertMon(editor.teamId, mon);
              else setOpponent(mon);
              setEditor(null);
            }}
          />
        )}
      </div>
    );
  }

  /*
    Layout: single column on mobile, 2-column you/opponent grid on desktop.
    The team carousel and speed divider sit above the grid full-width so they
    aren't squished into one column. Capped at 1100px so the cards don't
    stretch to absurd width on widescreens.
  */
  return (
    <div className="max-w-[1100px] mx-auto">
      <FieldBar />
      <TeamCarousel onAddMon={() => setAddMonPicker(true)} />
      <SpeedDivider speed={matchup.speed} priorityWarning={priorityWarning} />

      <div className="md:grid md:grid-cols-2 md:gap-4">
        {/* You */}
        <div>
          <MonCard
            mon={you}
            maxHp={matchup.attackerMaxHp}
            stats={matchup.attackerStats}
            side="you"
            onEdit={() => setEditor({ kind: 'team-mon', teamId: team.id, monId: you.id })}
            onChangeHp={(hp) => upsertMon(team.id, { ...you, currentHp: hp })}
            onChangeMega={(mega) => upsertMon(team.id, { ...you, mega })}
            onChangeStatus={(status) => upsertMon(team.id, { ...you, status })}
            onChangeBoosts={(boosts) => upsertMon(team.id, { ...you, boosts })}
          />
          <div>
            <div className="text-xxs uppercase tracking-wider opacity-55 mb-1.5">Your moves → opponent</div>
            {matchup.attackerMoves.map((r, i) => (
              <MoveRow key={i} result={r} defenderForSturdy={opponent} />
            ))}
          </div>
        </div>

        {/* Opponent */}
        <div>
          <MonCard
            mon={opponent}
            maxHp={matchup.defenderMaxHp}
            stats={matchup.defenderStats}
            side="opp"
            onEdit={() => setEditor({ kind: 'opponent' })}
            onSwap={() => setOppPicker(true)}
            onChangeHp={(hp) => updateOpponent({ currentHp: hp })}
            onChangeMega={(mega) => updateOpponent({ mega })}
            onChangeStatus={(status) => updateOpponent({ status })}
            onChangeBoosts={(boosts) => updateOpponent({ boosts })}
            onChangeAbility={(ability) => updateOpponent({ ability })}
          />
          <div>
            <div className="text-xxs uppercase tracking-wider opacity-55 mb-1.5">Their moves → you</div>
            {matchup.defenderMoves.map((r, i) => (
              <MoveRow key={i} result={r} defenderForSturdy={you} />
            ))}
          </div>
        </div>
      </div>

      {editor && editorMon && (
        <MonEditor
          open
          initial={editorMon}
          isForOpponent={editor.kind === 'opponent'}
          onClose={() => setEditor(null)}
          onSave={(mon) => {
            if (editor.kind === 'team-mon') upsertMon(editor.teamId, mon);
            else setOpponent(mon);
            setEditor(null);
          }}
        />
      )}

      <SpeciesPicker open={oppPicker} onClose={() => setOppPicker(false)} onPick={(s) => setOpponent(defaultOpponentMon(s))} />
      <SpeciesPicker
        open={addMonPicker}
        onClose={() => setAddMonPicker(false)}
        showRecents={false}
        onPick={(species) => {
          const mon = defaultTeamMon(species);
          upsertMon(team.id, mon);
          setAddMonPicker(false);
          setEditor({ kind: 'team-mon', teamId: team.id, monId: mon.id });
        }}
      />
    </div>
  );
}
