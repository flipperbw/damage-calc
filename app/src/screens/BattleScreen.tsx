import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { calculateMatchup } from '@/calc/adapter';
import { GEN, toID } from '@/calc/gen';
import { megaFormeName } from '@/calc/helpers';
import { findHardestHitter, findTankiestBuild } from '@/calc/worst-case';
import { DisguiseBanner } from '@/components/DisguiseBanner';
import { BuildDropdown } from '@/components/editor/BuildDropdown';
import { MonEditor } from '@/components/editor/MonEditor';
import { FieldBar } from '@/components/FieldBar';
import { MonCard } from '@/components/MonCard';
import { MoveRow } from '@/components/MoveRow';
import { SpeciesPicker } from '@/components/pickers/SpeciesPicker';
import { SpeedDivider } from '@/components/SpeedDivider';
import { Sprite } from '@/components/Sprite';
import { TeamCarousel } from '@/components/TeamCarousel';
import { TypeBadge } from '@/components/TypeBadge';
import { useStore } from '@/store';
import { defaultOpponentMon, defaultTeamMon } from '@/store/factories';
import { applySynthIfMissing, synthesizeBuild } from '@/store/synthesize';
import type { SavedMon } from '@/types';

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
  // Quick "swap me" picker for ad-hoc what-if calcs - tapping the your-side
  // card surface (not sprite/name, which stay wired to edit) opens this.
  const [youPicker, setYouPicker] = useState(false);
  // Ad-hoc you-side override: when set, displaces the active team mon for
  // calc + UI without writing to the team. HP/mega/status/boost edits flow
  // here instead of upsertMon. Cleared by the "Restore" pill or by switching
  // active mons in the team carousel. Local-state-only - intentionally NOT
  // persisted; ad-hoc by name and behavior.
  const [youOverride, setYouOverride] = useState<SavedMon | null>(null);
  // Editor-open flag for the ad-hoc you mon. Editor target lives in the store
  // for team / opponent paths, but the override is local-only so we keep this
  // alongside it. Tapping sprite/name on an ad-hoc mon flips this true.
  const [youOverrideEditing, setYouOverrideEditing] = useState(false);
  // Pre-worst-case opponent snapshot. Set when the user taps either of the
  // worst-case buttons; consumed by Revert. Local-only so reloads don't
  // strand the user with a "Revert" pill that points at a stale snapshot.
  const [oppPreWorstCase, setOppPreWorstCase] = useState<SavedMon | null>(null);
  // Which worst-case mode is currently applied. Drives the active-button
  // styling and prevents redundant re-clicks. Cleared by Revert or when
  // either button switches modes (one snapshot covers the whole session).
  const [oppMode, setOppMode] = useState<'hardest' | 'tankiest' | null>(null);
  // Per-side mobile collapse. Collapsing a side hides its card body AND its
  // move rows so only the identity header shows - useful for focusing on the
  // other mon on a small screen. Mobile-only (the cards hide via hidden
  // md:block / md:flex). Ephemeral, not persisted.
  const [youCollapsed, setYouCollapsed] = useState(false);
  const [oppCollapsed, setOppCollapsed] = useState(false);

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

  const teamYou = team?.mons[activeIndex];
  // Drop the ad-hoc override whenever the team-side identity changes (user
  // switches active slot, deletes the active mon, switches teams). The
  // override is bound to "the slot that was active when I picked it"; once
  // the user is meaningfully on a different slot, the ad-hoc context is gone.
  //
  // Skipped entirely in no-team mode: there's no team-slot anchor to drift
  // from, and the user's standalone ad-hoc pick (id starts with "adhoc-")
  // should stick until they explicitly swap or restore.
  if (team && youOverride && (!teamYou || teamYou.id !== youOverride.id.replace(/^adhoc-of-/, ''))) {
    // Synchronously clear; the React reconciler picks it up next render.
    setYouOverride(null);
    setYouOverrideEditing(false);
  }
  const you = youOverride ?? teamYou;

  // Memo so we don't recompute when unrelated store slices change. Pass the
  // team's format so calc applies the Doubles 0.75x spread reduction to
  // multi-target moves (Earthquake, Eruption, Discharge, Surf, ...) when the
  // user is on a Doubles team.
  const matchup = useMemo(
    () => (you && opponent ? calculateMatchup(you, opponent, field, team?.format) : null),
    [you, opponent, field, team?.format],
  );

  // Per-side spread-view toggle. Default 'spread' matches what calc returns
  // (the 0.75x-reduced damage of a multi-target hit). Flipping to 'single'
  // shows the full-damage equivalent on every spread move in that section;
  // non-spread moves ignore the toggle. State is intentionally ephemeral —
  // doesn't persist across mon swaps or format changes, since the answer
  // it gives no longer applies. The header button only renders in Doubles
  // *and* when the relevant side actually has a spread move queued up.
  const [yourSpreadView, setYourSpreadView] = useState<'spread' | 'single'>('spread');
  const [theirSpreadView, setTheirSpreadView] = useState<'spread' | 'single'>('spread');
  const yourHasSpread = !!matchup?.attackerMoves.some((m) => m.isSpread);
  const theirHasSpread = !!matchup?.defenderMoves.some((m) => m.isSpread);
  const isDoubles = team?.format === 'doubles';
  // Reset both sides when the format flips or the active mons change so we
  // don't carry a "single" view into a context where it no longer makes
  // sense.
  useEffect(() => {
    setYourSpreadView('spread');
    setTheirSpreadView('spread');
  }, [team?.format, you?.id, opponent?.id]);

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

  // Prominent CTA card rendered above the calc UI when the user has no team.
  // Keeps the create-team entry point at the same visual weight as the old
  // empty-state screen, while leaving room for the ad-hoc skeleton picker
  // below so users can still compare two mons without a team.
  const noTeamCta = !team ? (
    <div
      className="bg-surface border border-surface-hi rounded-card p-5 mb-4 text-center"
      data-testid="battle-no-team-cta"
    >
      <h2 className="text-lg font-bold mb-1">No team yet</h2>
      <p className="text-sm opacity-70 mb-4">Create one to keep builds saved, or pick two mons below to compare without saving.</p>
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
  ) : null;

  if (!you || !opponent || !matchup) {
    return (
      <div className="max-w-[1100px] mx-auto">
        {noTeamCta}
        <FieldBar />
        <TeamCarousel onAddMon={() => setAddMonPicker(true)} />

        {/* Skeleton picker UI: two card-shaped placeholders side-by-side on
            desktop, stacked on mobile with a "vs." divider. Mirrors the layout
            of the main battle render so picking a side feels like that side
            "fills in" the skeleton. Each side either previews a picked mon
            (sprite + name + types, tap to swap) or shows a dashed-border CTA. */}
        <div className="md:grid md:grid-cols-2 md:gap-4 flex flex-col gap-3">
          {/* You side */}
          {you ? (
            <PickedPreview
              mon={you}
              side="you"
              testId="picked-you"
              onSwap={() => (team ? setYouPicker(true) : setYouPicker(true))}
            />
          ) : !team ? (
            <SkeletonPickCard
              onClick={() => setYouPicker(true)}
              label="Tap to pick your Pokémon"
              side="you"
              testId="pick-you-adhoc"
            />
          ) : (
            <SkeletonPickCard
              onClick={() => setAddMonPicker(true)}
              label="Add your first Pokémon"
              side="you"
              testId="add-first-mon"
            />
          )}

          {/* Mobile-only "vs." divider between stacked sides. */}
          <div className="md:hidden flex items-center gap-2 my-1" aria-hidden>
            <div className="flex-1 border-t border-surface-hi" />
            <span className="text-[10px] uppercase tracking-wider opacity-50">vs.</span>
            <div className="flex-1 border-t border-surface-hi" />
          </div>

          {/* Opponent side */}
          {opponent ? (
            <PickedPreview mon={opponent} side="opp" testId="picked-opp" onSwap={() => setOppPicker(true)} />
          ) : (
            <SkeletonPickCard
              onClick={() => setOppPicker(true)}
              label="Tap to pick an opponent"
              side="opp"
              testId="pick-opponent"
            />
          )}
        </div>
        <SpeciesPicker
          open={oppPicker}
          onClose={() => setOppPicker(false)}
          onPick={(s) => {
            const mon = defaultOpponentMon(s);
            setOpponent(mon);
            applySynthIfMissing(
              mon,
              () => useStore.getState().opponent,
              (patched) => setOpponent(patched),
            );
          }}
        />
        {team && (
          <SpeciesPicker
            open={addMonPicker}
            onClose={() => setAddMonPicker(false)}
            showRecents={false}
            excludeSpecies={new Set(team.mons.map((m) => m.species))}
            onPick={(species) => {
              const mon = defaultTeamMon(species);
              upsertMon(team.id, mon);
              applySynthIfMissing(
                mon,
                () => useStore.getState().teams.find((t) => t.id === team.id)?.mons.find((m) => m.id === mon.id),
                (patched) => upsertMon(team.id, patched),
              );
              setAddMonPicker(false);
              // Only open the editor when the mon arrives fully populated
              // from a curated build. For un-curated species the synth
              // fills moves / item / ability asynchronously, so opening
              // the editor here would flash an empty profile until the
              // patch lands. The user can tap the slot to edit afterward.
              if (mon.buildName) setEditor({ kind: 'team-mon', teamId: team.id, monId: mon.id });
            }}
          />
        )}
        {/* No-team mode: same youPicker as the main render so picking from
            the empty-state CTA routes through the existing ad-hoc flow. */}
        {!team && (
          <SpeciesPicker
            open={youPicker}
            onClose={() => setYouPicker(false)}
            showRecents={false}
            onPick={(species) => {
              const fresh = defaultTeamMon(species);
              const adhocMon: SavedMon = { ...fresh, id: `adhoc-${fresh.id}` };
              setYouOverride(adhocMon);
              setYouPicker(false);
              if (!adhocMon.buildName) {
                void synthesizeBuild(species).then((built) => {
                  if (!built) return;
                  setYouOverride((prev) => {
                    if (!prev || prev.id !== adhocMon.id || prev.species !== species) return prev;
                    const movesUntouched = prev.moves.every((m) => !m);
                    const spsUntouched = Object.values(prev.sps).every((v) => !v);
                    if (!movesUntouched || !spsUntouched) return prev;
                    return {
                      ...prev,
                      buildName: 'Auto · Max-Speed Sweeper',
                      ability: built.ability,
                      nature: built.nature,
                      sps: built.sps,
                      moves: built.moves,
                    };
                  });
                });
              }
            }}
          />
        )}
        {editor && editorMon && (
          <MonEditor
            open
            initial={editorMon}
            isForOpponent={editor.kind === 'opponent'}
            excludeSpecies={
              editor.kind === 'team-mon' && team
                ? new Set(team.mons.filter((m) => m.id !== editorMon.id).map((m) => m.species))
                : undefined
            }
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
      {noTeamCta}
      <FieldBar />
      <TeamCarousel
        onAddMon={() => setAddMonPicker(true)}
        suppressActive={!!youOverride}
        onSlotTap={() => setYouOverride(null)}
      />
      <SpeedDivider speed={matchup.speed} priorityWarning={priorityWarning} />

      <div className="md:grid md:grid-cols-2 md:gap-4">
        {/* You */}
        <div>
          <MonCard
            mon={you}
            maxHp={matchup.attackerMaxHp}
            stats={matchup.attackerStats}
            side="you"
            onEdit={
              // Both branches are runtime-safe: in no-team mode `team` is null
              // but `youOverride` is always set (the only path that surfaces
              // a you-side card without a team), so the team!.id branch never
              // executes. TS can't follow the cross-state invariant, hence
              // the non-null assertions here and below.
              youOverride ? () => setYouOverrideEditing(true) : () => setEditor({ kind: 'team-mon', teamId: team!.id, monId: you!.id })
            }
            onSwap={() => setYouPicker(true)}
            onChangeHp={(hp) =>
              youOverride ? setYouOverride({ ...youOverride, currentHp: hp }) : upsertMon(team!.id, { ...you!, currentHp: hp })
            }
            onChangeInBattleForme={(inBattleForme) =>
              youOverride
                ? setYouOverride({ ...youOverride, inBattleForme })
                : upsertMon(team!.id, { ...you!, inBattleForme })
            }
            onChangeMega={(mega) =>
              youOverride ? setYouOverride({ ...youOverride, mega }) : upsertMon(team!.id, { ...you!, mega })
            }
            onChangeStatus={(status) =>
              youOverride ? setYouOverride({ ...youOverride, status }) : upsertMon(team!.id, { ...you!, status })
            }
            onChangeBoosts={(boosts) =>
              youOverride ? setYouOverride({ ...youOverride, boosts }) : upsertMon(team!.id, { ...you!, boosts })
            }
            onChangeAbility={
              youOverride ? (ability) => setYouOverride({ ...youOverride, ability }) : undefined
            }
            collapsed={youCollapsed}
            onToggleCollapse={() => setYouCollapsed((c) => !c)}
            onResetBattle={() =>
              youOverride
                ? setYouOverride({ ...youOverride, currentHp: undefined, boosts: {}, status: undefined })
                : upsertMon(team!.id, { ...you!, currentHp: undefined, boosts: {}, status: undefined })
            }
          />
          {youOverride && team && (
            // Only meaningful when there's a real team mon to restore to.
            // In no-team mode the youOverride IS the canonical pick - the
            // user wouldn't read "Restore" as "go back to nothing".
            <button
              type="button"
              onClick={() => setYouOverride(null)}
              data-testid="you-adhoc-restore"
              className="w-full -mt-1 mb-2.5 flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-warn/10 border border-warn/30 text-warn text-[11px] font-semibold hover:bg-warn/20"
            >
              <span>Ad-hoc - replaces team for this session</span>
              <span aria-hidden>· Restore ✕</span>
            </button>
          )}
          {/* Move rows hide on mobile when this side is collapsed (md+ always
              shows them so collapse stays mobile-only). */}
          <div className={youCollapsed ? 'hidden md:block' : ''}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-xxs uppercase tracking-wider opacity-55">Your moves → opponent</div>
              {isDoubles && yourHasSpread && (
                <SpreadToggle value={yourSpreadView} onChange={setYourSpreadView} testId="your-spread-toggle" />
              )}
            </div>
            <DisguiseBanner mon={opponent} />
            {matchup.attackerMoves.map((r, i) => (
              <MoveRow key={i} result={r} defenderForSturdy={opponent} spreadView={yourSpreadView} />
            ))}
          </div>
        </div>

        {/* Mobile-only divider between the two stacked sides. Disappears at md+
            where the layout is two columns and the visual separation is the
            grid gap. */}
        <div className="md:hidden flex items-center gap-2 my-4" aria-hidden>
          <div className="flex-1 border-t border-surface-hi" />
          <span className="text-[10px] uppercase tracking-wider opacity-50">vs.</span>
          <div className="flex-1 border-t border-surface-hi" />
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
            onChangeInBattleForme={(inBattleForme) => updateOpponent({ inBattleForme })}
            onChangeStatus={(status) => updateOpponent({ status })}
            onChangeBoosts={(boosts) => updateOpponent({ boosts })}
            onChangeAbility={(ability) => updateOpponent({ ability })}
            onChangeItem={(item) => updateOpponent({ item })}
            onChangeNature={(nature) => updateOpponent({ nature })}
            collapsed={oppCollapsed}
            onToggleCollapse={() => setOppCollapsed((c) => !c)}
            onResetBattle={() => updateOpponent({ currentHp: undefined, boosts: {}, status: undefined })}
          />
          {/* Opponent controls + move rows. Hidden on mobile when collapsed so
              only the identity header shows. One row holds the profile switcher
              (icon dropdown), the worst-case buttons, and Revert. md:flex keeps
              the row laid out on desktop where the wrapper is forced visible. */}
          <div className={oppCollapsed ? 'hidden md:block' : ''}>
          {/* Opponent profile switcher: one-tap swap to any curated meta set
              (or the Auto build) for this species. Reuses the editor's
              BuildDropdown in compact (icon) mode. Applying a set preserves the
              user's tweaked battle state (HP / status / boosts / mega survive
              the merge) and clears any active worst-case mode + its revert
              snapshot, since the user is now on a deliberately-chosen build. */}
          <div className="flex gap-1.5 mb-2.5 -mt-1 items-stretch">
            <BuildDropdown
              species={opponent.species}
              selectedName={opponent.buildName}
              compact
              onApply={(patch) => {
                updateOpponent(patch);
                setOppMode(null);
                setOppPreWorstCase(null);
              }}
            />
            <button
              type="button"
              disabled={oppMode === 'hardest'}
              onClick={() => {
                const res = findHardestHitter(opponent.species, you!, field, team?.format, opponent);
                if (!res) {
                  // Either the species has no synthesisable build, OR every
                  // synth combination did less damage than the current opp
                  // set. Both land here; the message covers both cases.
                  toast(`${opponent.species}'s current build already maxes damage to ${you!.species}`);
                  return;
                }
                if (!oppPreWorstCase) setOppPreWorstCase(opponent);
                // Preserve user-tweaked battle state (HP/mega/status/boosts);
                // only the build itself swaps. Stable id keeps the slot from
                // re-rendering as a new entity.
                setOpponent({
                  ...res.mon,
                  id: opponent.id,
                  currentHp: opponent.currentHp,
                  mega: opponent.mega,
                  status: opponent.status,
                  boosts: opponent.boosts,
                });
                setOppMode('hardest');
              }}
              data-testid="opp-hardest-hitter"
              aria-pressed={oppMode === 'hardest'}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors ${
                oppMode === 'hardest'
                  ? 'bg-danger/30 border-danger text-danger cursor-not-allowed shadow-[inset_0_0_0_1px_rgba(255,107,107,0.35)]'
                  : 'bg-danger/10 border-danger/30 text-danger hover:bg-danger/20'
              }`}
            >
              <span aria-hidden>🔥</span>
              <span>Deadliest</span>
            </button>
            <button
              type="button"
              disabled={oppMode === 'tankiest'}
              onClick={() => {
                const res = findTankiestBuild(opponent.species, you!, field, team?.format, opponent);
                if (!res) {
                  toast(`${opponent.species}'s current build already minimizes damage from ${you!.species}`);
                  return;
                }
                if (!oppPreWorstCase) setOppPreWorstCase(opponent);
                setOpponent({
                  ...res.mon,
                  id: opponent.id,
                  currentHp: opponent.currentHp,
                  mega: opponent.mega,
                  status: opponent.status,
                  boosts: opponent.boosts,
                });
                setOppMode('tankiest');
              }}
              data-testid="opp-tankiest"
              aria-pressed={oppMode === 'tankiest'}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors ${
                oppMode === 'tankiest'
                  ? 'bg-accent-2/30 border-accent-2 text-accent-2 cursor-not-allowed shadow-[inset_0_0_0_1px_rgba(92,140,255,0.35)]'
                  : 'bg-accent-2/10 border-accent-2/30 text-accent-2 hover:bg-accent-2/20'
              }`}
            >
              <span aria-hidden>🛡</span>
              <span>Tankiest</span>
            </button>
            {/* Always rendered (disabled with no snapshot) so the button row
                stays put instead of jumping when a worst-case build is applied. */}
            <button
              type="button"
              disabled={!oppPreWorstCase}
              onClick={() => {
                if (!oppPreWorstCase) return;
                setOpponent(oppPreWorstCase);
                setOppPreWorstCase(null);
                setOppMode(null);
              }}
              data-testid="opp-revert"
              className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-surface border border-surface-hi text-[11px] font-semibold opacity-80 hover:opacity-100 disabled:opacity-30 disabled:hover:opacity-30"
              aria-label="Revert opponent build"
            >
              <span aria-hidden>↺</span>
              <span>Revert</span>
            </button>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-xxs uppercase tracking-wider opacity-55">Their moves → you</div>
              {isDoubles && theirHasSpread && (
                <SpreadToggle value={theirSpreadView} onChange={setTheirSpreadView} testId="their-spread-toggle" />
              )}
            </div>
            <DisguiseBanner mon={you} />
            {matchup.defenderMoves.map((r, i) => (
              <MoveRow key={i} result={r} defenderForSturdy={you} spreadView={theirSpreadView} />
            ))}
          </div>
          </div>
        </div>
      </div>

      {editor && editorMon && (
        <MonEditor
          open
          initial={editorMon}
          isForOpponent={editor.kind === 'opponent'}
          excludeSpecies={
            editor.kind === 'team-mon' && team
              ? new Set(team.mons.filter((m) => m.id !== editorMon.id).map((m) => m.species))
              : undefined
          }
          onClose={() => setEditor(null)}
          onSave={(mon) => {
            if (editor.kind === 'team-mon') upsertMon(editor.teamId, mon);
            else setOpponent(mon);
            setEditor(null);
          }}
        />
      )}

      {youOverride && youOverrideEditing && (
        <MonEditor
          open
          initial={youOverride}
          onClose={() => setYouOverrideEditing(false)}
          onSave={(mon) => {
            // Stamp the special id back so the auto-clear effect that watches
            // for "user moved off this slot" still recognises this as ad-hoc.
            setYouOverride({ ...mon, id: youOverride.id });
            setYouOverrideEditing(false);
          }}
          onDelete={() => {
            // "Delete" on an ad-hoc mon means "drop the override", not delete
            // a team entry. Equivalent to tapping Restore.
            setYouOverride(null);
            setYouOverrideEditing(false);
          }}
        />
      )}

      <SpeciesPicker
        open={oppPicker}
        onClose={() => setOppPicker(false)}
        onPick={(s) => {
          const mon = defaultOpponentMon(s);
          setOpponent(mon);
          // Species without a curated build land here with empty moves; the
          // synth fill matches what the "no opponent yet" picker above does
          // so swapping opponents behaves identically to picking one fresh.
          applySynthIfMissing(
            mon,
            () => useStore.getState().opponent,
            (patched) => setOpponent(patched),
          );
        }}
      />
      {team && (
        <SpeciesPicker
          open={addMonPicker}
          onClose={() => setAddMonPicker(false)}
          showRecents={false}
          excludeSpecies={new Set(team.mons.map((m) => m.species))}
          onPick={(species) => {
            const mon = defaultTeamMon(species);
            upsertMon(team.id, mon);
            applySynthIfMissing(
              mon,
              () => useStore.getState().teams.find((t) => t.id === team.id)?.mons.find((m) => m.id === mon.id),
              (patched) => upsertMon(team.id, patched),
            );
            setAddMonPicker(false);
            // Only auto-open the editor for curated builds. See the
            // identical guard on the earlier branch (~L196).
            if (mon.buildName) setEditor({ kind: 'team-mon', teamId: team.id, monId: mon.id });
          }}
        />
      )}
      <SpeciesPicker
        open={youPicker}
        onClose={() => setYouPicker(false)}
        showRecents={false}
        onPick={(species) => {
          // Build an ad-hoc mon with a special id. In team mode, the id is
          // keyed off the *teammate* (not the currently-displayed `you`)
          // so the auto-clear effect that watches team-slot changes still
          // recognises this as ad-hoc - keying off `you` while an override
          // is already active would produce a nested `adhoc-of-adhoc-of-<id>`
          // prefix that the strip-one-layer logic misreads as a mismatch
          // and silently nukes. In no-team mode there's no slot anchor, so
          // we use a standalone "adhoc-" prefix that the cross-team-mon
          // clear logic ignores.
          const fresh = defaultTeamMon(species);
          const adhocId = teamYou ? `adhoc-of-${teamYou.id}` : `adhoc-${fresh.id}`;
          const adhocMon: SavedMon = { ...fresh, id: adhocId };
          setYouOverride(adhocMon);
          setYouPicker(false);
          // Synth fill for uncurated species (Dedenne, Aegislash-Shield,
          // anything not in setdex-champions). Mirrors the team-add picker
          // a few branches up. Uses the functional setter form so the
          // patch lands on whatever the override currently is — and bails
          // if the user has already changed species or cleared the override
          // by the time synth resolves.
          if (!adhocMon.buildName) {
            void synthesizeBuild(species).then((built) => {
              if (!built) return;
              setYouOverride((prev) => {
                if (!prev || prev.id !== adhocId || prev.species !== species) return prev;
                const movesUntouched = prev.moves.every((m) => !m);
                const spsUntouched = Object.values(prev.sps).every((v) => !v);
                if (!movesUntouched || !spsUntouched) return prev;
                return {
                  ...prev,
                  buildName: 'Auto · Max-Speed Sweeper',
                  ability: built.ability,
                  nature: built.nature,
                  sps: built.sps,
                  moves: built.moves,
                };
              });
            });
          }
        }}
      />
    </div>
  );
}

/**
 * Two-state segmented toggle for the spread-move damage view. A single tap
 * flips between "Spread" (the 0.75x-reduced damage calc returns by default
 * for multi-target moves in Doubles) and "Single" (the full damage as if
 * aimed at one mon). Visual treatment matches the small pill chips used
 * elsewhere on the BattleScreen.
 */
function SpreadToggle({
  value,
  onChange,
  testId,
}: {
  value: 'spread' | 'single';
  onChange: (next: 'spread' | 'single') => void;
  testId?: string;
}) {
  function toggle() {
    onChange(value === 'spread' ? 'single' : 'spread');
  }
  return (
    <button
      type="button"
      onClick={toggle}
      data-testid={testId}
      aria-pressed={value === 'single'}
      title={
        value === 'spread'
          ? 'Showing spread damage (×0.75). Tap to see single-target damage.'
          : 'Showing single-target damage. Tap to revert to spread.'
      }
      style={{ touchAction: 'manipulation' }}
      className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border select-none cursor-pointer ${
        value === 'single'
          ? 'bg-accent/20 text-accent border-accent/40'
          : 'bg-white/[0.04] text-text-mute border-surface-hi'
      }`}
    >
      <span aria-hidden className="mr-1">✥</span>
      {value === 'spread' ? 'Spread' : 'Single'}
    </button>
  );
}

/**
 * Dashed-border placeholder card shown in place of an unpicked you/opponent
 * slot. Visually echoes the empty-slot cards in TeamsScreen so the user reads
 * it as "this is where a Pokémon will land" rather than just a CTA button.
 * Side-tint hints at which slot will fill: accent for you, danger for opp.
 */
function SkeletonPickCard({
  onClick,
  label,
  side,
  testId,
}: {
  onClick: () => void;
  label: string;
  side: 'you' | 'opp';
  testId?: string;
}) {
  const tint = side === 'you' ? 'border-accent/30 hover:border-accent/60 hover:text-accent' : 'border-danger/25 hover:border-danger/60 hover:text-danger';
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={`bg-surface/40 border border-dashed ${tint} rounded-card p-6 min-h-[260px] flex flex-col items-center justify-center gap-2 text-text-mute transition-colors`}
    >
      <span className="text-3xl leading-none opacity-60">＋</span>
      <span className="text-sm font-semibold opacity-80">{label}</span>
    </button>
  );
}

/**
 * Compact preview shown for a side that's been picked while the other side is
 * still skeleton. Sprite + name + types + a "Swap" affordance, matching the
 * filled team-slot tile in TeamsScreen so the page reads as a uniform set of
 * card-shaped slots. Once both sides are picked the BattleScreen falls
 * through to the full MonCard render below.
 */
function PickedPreview({
  mon,
  side,
  testId,
  onSwap,
}: {
  mon: SavedMon;
  side: 'you' | 'opp';
  testId?: string;
  onSwap: () => void;
}) {
  const effectiveSpecies = mon.mega ? megaFormeName(mon.species, mon.mega, mon.item) : mon.species;
  const sp = GEN.species.get(toID(effectiveSpecies) as any) ?? GEN.species.get(toID(mon.species) as any);
  const types = (sp?.types ?? []) as string[];
  const tint = side === 'you' ? 'border-accent/20' : 'border-danger/20';
  const waitingLabel = side === 'you' ? 'Waiting on opponent…' : 'Waiting on your pick…';
  return (
    <div
      className={`bg-surface border ${tint} rounded-card p-6 min-h-[260px] flex flex-col items-center justify-center gap-2`}
      data-testid={testId}
    >
      <Sprite species={effectiveSpecies} className="w-20 h-20" />
      <div className="font-bold text-base">{mon.species}</div>
      <div className="flex gap-1 flex-wrap justify-center">
        {types.map((t) => (
          <TypeBadge key={t} type={t} />
        ))}
      </div>
      <button
        type="button"
        onClick={onSwap}
        className="mt-1 text-[11px] uppercase tracking-wider opacity-60 hover:opacity-100 underline underline-offset-2"
      >
        Swap
      </button>
      <span className="text-[11px] opacity-50 italic mt-1">{waitingLabel}</span>
    </div>
  );
}
