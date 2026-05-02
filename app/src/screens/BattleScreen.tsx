import { useState } from 'react';
import { useStore } from '../store';
import { calculateMatchup } from '../calc/adapter';
import { MonCard } from '../components/MonCard';
import { TeamCarousel } from '../components/TeamCarousel';
import { FieldBar } from '../components/FieldBar';
import { MoveRow } from '../components/MoveRow';
import { SpeedDivider } from '../components/SpeedDivider';
import { MonEditor } from '../components/editor/MonEditor';
import { SpeciesPicker } from '../components/pickers/SpeciesPicker';
import type { SavedMon } from '../types';

function emptyMon(species: string): SavedMon {
  return {
    id: crypto.randomUUID(),
    species,
    nature: 'Hardy',
    sps: {},
    moves: ['', '', '', ''],
    isMega: false,
    boosts: {},
  };
}

export function BattleScreen() {
  const team = useStore(s => s.teams.find(t => t.id === s.activeTeamId));
  const activeIndex = useStore(s => s.activeMonIndex);
  const opponent = useStore(s => s.opponent);
  const setOpponent = useStore(s => s.setOpponent);
  const upsertMon = useStore(s => s.upsertMon);
  const field = useStore(s => s.field);

  const [editor, setEditor] = useState<{ side: 'you' | 'opp'; mon: SavedMon } | null>(null);
  const [oppPicker, setOppPicker] = useState(false);

  if (!team || team.mons.length === 0) {
    return (
      <div className="text-center mt-10 opacity-70">
        <p>
          No active team. Go to <b>Teams</b> and create one.
        </p>
      </div>
    );
  }
  const you = team.mons[activeIndex];
  if (!you) return null;

  if (!opponent) {
    return (
      <>
        <FieldBar />
        <TeamCarousel />
        <div className="text-center mt-6">
          <button
            onClick={() => setOppPicker(true)}
            className="px-4 py-2 rounded-lg bg-accent-gradient text-white font-semibold"
          >
            Pick opponent
          </button>
        </div>
        <SpeciesPicker
          open={oppPicker}
          onClose={() => setOppPicker(false)}
          onPick={s => setOpponent(emptyMon(s))}
        />
      </>
    );
  }

  const matchup = calculateMatchup(you, opponent, field);

  return (
    <>
      <FieldBar />
      <TeamCarousel />

      <MonCard
        mon={you}
        maxHp={matchup.attackerMaxHp}
        side="you"
        onEdit={() => setEditor({ side: 'you', mon: you })}
        onChangeHp={hp => upsertMon(team.id, { ...you, currentHp: hp })}
        onChangeMega={isMega => upsertMon(team.id, { ...you, isMega })}
      />

      <div>
        <div className="text-xxs uppercase tracking-wider opacity-55 mb-1.5">
          Your moves → opponent
        </div>
        {matchup.attackerMoves.map((r, i) => (
          <MoveRow key={i} result={r} />
        ))}
      </div>

      <SpeedDivider speed={matchup.speed} />

      <MonCard
        mon={opponent}
        maxHp={matchup.defenderMaxHp}
        side="opp"
        onEdit={() => setEditor({ side: 'opp', mon: opponent })}
        onChangeHp={hp => setOpponent({ ...opponent, currentHp: hp })}
        onChangeMega={isMega => setOpponent({ ...opponent, isMega })}
      />

      <div>
        <div className="text-xxs uppercase tracking-wider opacity-55 mb-1.5">
          Their moves → you
        </div>
        {matchup.defenderMoves.map((r, i) => (
          <MoveRow key={i} result={r} />
        ))}
      </div>

      {editor && (
        <MonEditor
          open
          initial={editor.mon}
          onClose={() => setEditor(null)}
          onSave={mon => {
            if (editor.side === 'you') upsertMon(team.id, mon);
            else setOpponent(mon);
            setEditor(null);
          }}
        />
      )}

      <SpeciesPicker
        open={oppPicker}
        onClose={() => setOppPicker(false)}
        onPick={s => setOpponent(emptyMon(s))}
      />
    </>
  );
}
