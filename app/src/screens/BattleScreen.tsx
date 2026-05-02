import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { calculateMatchup } from '../calc/adapter';
import { MonCard } from '../components/MonCard';
import { TeamCarousel, VerticalTeamCarousel } from '../components/TeamCarousel';
import { FieldBar } from '../components/FieldBar';
import { MoveRow } from '../components/MoveRow';
import { SpeedDivider } from '../components/SpeedDivider';
import { MonEditor } from '../components/editor/MonEditor';
import { SpeciesPicker } from '../components/pickers/SpeciesPicker';
import { defaultOpponentMon } from '../store/factories';

export function BattleScreen() {
  const team = useStore(s => s.teams.find(t => t.id === s.activeTeamId));
  const activeIndex = useStore(s => s.activeMonIndex);
  const opponent = useStore(s => s.opponent);
  const setOpponent = useStore(s => s.setOpponent);
  const updateOpponent = useStore(s => s.updateOpponent);
  const upsertMon = useStore(s => s.upsertMon);
  const field = useStore(s => s.field);
  // Editor target lives in the store so it survives iOS unloading the tab.
  // The editor is rendered for the *current* `you` or `opponent` mon based
  // on the persisted target — losing the WIP draft on reload is the agreed
  // tradeoff (keystroke writes would be too noisy).
  const editor = useStore(s => s.editor);
  const setEditor = useStore(s => s.setEditor);

  const [oppPicker, setOppPicker] = useState(false);

  // Resolve the persisted editor target into the live mon to edit. If the
  // target has gone stale (team deleted, opponent cleared), the resolution
  // returns null and the editor stays closed.
  const editorMon = (() => {
    if (!editor) return null;
    if (editor.kind === 'opponent') return opponent;
    if (editor.kind === 'team-mon' && team && editor.teamId === team.id) {
      return team.mons.find(m => m.id === editor.monId) ?? null;
    }
    return null;
  })();

  const you = team?.mons[activeIndex];

  // Memo so we don't recompute when unrelated store slices change.
  const matchup = useMemo(
    () => (you && opponent ? calculateMatchup(you, opponent, field) : null),
    [you, opponent, field],
  );

  // Priority-flips-order warning. Fires when:
  // - You outspeed but opponent has a positive-priority move (they hit first), or
  // - You're slower but you have a positive-priority move (you hit first).
  const priorityWarning = useMemo(() => {
    if (!matchup) return undefined;
    const { speed, attackerMoves, defenderMoves } = matchup;
    if (speed.attackerOutspeeds) {
      const oppPrio = defenderMoves.find(m => m.priority > 0 && m.moveName);
      if (oppPrio) return `${oppPrio.moveName} flips order`;
    } else if (speed.delta < 0) {
      const yourPrio = attackerMoves.find(m => m.priority > 0 && m.moveName);
      if (yourPrio) return `${yourPrio.moveName} flips order`;
    }
    return undefined;
  }, [matchup]);

  if (!team || team.mons.length === 0) {
    return (
      <div className="text-center mt-10 opacity-70">
        <p>
          No active team. Go to <b>Teams</b> and create one.
        </p>
      </div>
    );
  }
  if (!you) return null;

  if (!opponent || !matchup) {
    return (
      <div className="md:grid md:grid-cols-[140px_minmax(0,1fr)_minmax(0,1fr)] md:gap-4">
        <div className="md:col-span-3">
          <FieldBar />
        </div>
        <div className="md:flex md:flex-col">
          <div className="md:hidden">
            <TeamCarousel />
          </div>
          <div className="hidden md:block">
            <VerticalTeamCarousel />
          </div>
        </div>
        <div className="md:col-span-2">
          {/*
            Empty-opponent placeholder: the card itself is the swap surface,
            matching the populated state. Single tap-target rather than a
            separate button because that's what the populated card does too.
          */}
          <button
            onClick={() => setOppPicker(true)}
            data-testid="pick-opponent"
            className="w-full bg-surface border border-dashed border-danger/25 rounded-card p-6 text-center text-sm opacity-70 hover:opacity-100"
          >
            Tap to pick an opponent
          </button>
        </div>
        <SpeciesPicker
          open={oppPicker}
          onClose={() => setOppPicker(false)}
          onPick={s => setOpponent(defaultOpponentMon(s))}
        />
      </div>
    );
  }

  return (
    <div className="md:grid md:grid-cols-[140px_minmax(0,1fr)_minmax(0,1fr)] md:gap-4">
      <div className="md:col-span-3">
        <FieldBar />
      </div>

      {/* Team rail */}
      <div className="md:flex md:flex-col">
        <div className="md:hidden">
          <TeamCarousel />
        </div>
        <div className="hidden md:block">
          <VerticalTeamCarousel />
        </div>
      </div>

      {/* Center: you + your moves */}
      <div>
        <MonCard
          mon={you}
          maxHp={matchup.attackerMaxHp}
          side="you"
          onEdit={() => setEditor({ kind: 'team-mon', teamId: team.id, monId: you.id })}
          onChangeHp={hp => upsertMon(team.id, { ...you, currentHp: hp })}
          onChangeMega={mega => upsertMon(team.id, { ...you, mega })}
          onChangeStatus={status => upsertMon(team.id, { ...you, status })}
          onChangeBoosts={boosts => upsertMon(team.id, { ...you, boosts })}
        />
        <div>
          <div className="text-xxs uppercase tracking-wider opacity-55 mb-1.5">
            Your moves → opponent
          </div>
          {matchup.attackerMoves.map((r, i) => (
            <MoveRow key={i} result={r} defenderForSturdy={opponent} />
          ))}
        </div>
        <div className="md:hidden">
          <SpeedDivider speed={matchup.speed} priorityWarning={priorityWarning} />
        </div>
      </div>

      {/* Right: opponent + their moves */}
      <div>
        <MonCard
          mon={opponent}
          maxHp={matchup.defenderMaxHp}
          side="opp"
          onEdit={() => setEditor({ kind: 'opponent' })}
          onSwap={() => setOppPicker(true)}
          onChangeHp={hp => updateOpponent({ currentHp: hp })}
          onChangeMega={mega => updateOpponent({ mega })}
          onChangeStatus={status => updateOpponent({ status })}
          onChangeBoosts={boosts => updateOpponent({ boosts })}
        />
        <div>
          <div className="text-xxs uppercase tracking-wider opacity-55 mb-1.5">
            Their moves → you
          </div>
          {matchup.defenderMoves.map((r, i) => (
            <MoveRow key={i} result={r} defenderForSturdy={you} />
          ))}
        </div>
      </div>

      {/* Speed divider for desktop spans columns 2-3 */}
      <div className="hidden md:block md:col-start-2 md:col-span-2">
        <SpeedDivider speed={matchup.speed} priorityWarning={priorityWarning} />
      </div>

      {editor && editorMon && (
        <MonEditor
          open
          initial={editorMon}
          onClose={() => setEditor(null)}
          onSave={mon => {
            if (editor.kind === 'team-mon') upsertMon(editor.teamId, mon);
            else setOpponent(mon);
            setEditor(null);
          }}
        />
      )}

      <SpeciesPicker
        open={oppPicker}
        onClose={() => setOppPicker(false)}
        onPick={s => setOpponent(defaultOpponentMon(s))}
      />
    </div>
  );
}
