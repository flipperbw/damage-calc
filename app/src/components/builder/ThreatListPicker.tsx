import { useState } from 'react';
import { toast } from 'sonner';

import { useConfirm, usePrompt } from '@/components/ConfirmDialog';
import { PickerShell } from '@/components/pickers/PickerShell';
import { SpeciesPicker } from '@/components/pickers/SpeciesPicker';
import { spriteUrl } from '@/data/sprites';
import { useStore } from '@/store';
import { defaultOpponentMon } from '@/store/factories';
import type { SavedMon, ThreatList } from '@/types';

interface Props {
  selectedListId: string | null;
  onSelectList: (id: string) => void;
  /** Called when the user wants to edit a single mon in a threat list. */
  onEditThreatMon: (threatListId: string, monId: string) => void;
}

/**
 * Picker / manager for the Builder's threat lists. Renders a column of
 * cards: tap to "make active" (drives the matrix), per-row menu for
 * Rename / Duplicate / Delete (Delete is hidden for seed lists). The
 * selected list expands inline with its mon roster - tap a mon to open
 * MonEditor, tap "+ Add" to append a new mon.
 */
export function ThreatListPicker({ selectedListId, onSelectList, onEditThreatMon }: Props) {
  const lists = useStore((s) => s.threatLists);
  const createThreatList = useStore((s) => s.createThreatList);
  const renameThreatList = useStore((s) => s.renameThreatList);
  const duplicateThreatList = useStore((s) => s.duplicateThreatList);
  const deleteThreatList = useStore((s) => s.deleteThreatList);
  const upsertThreatMon = useStore((s) => s.upsertThreatMon);
  const removeThreatMon = useStore((s) => s.removeThreatMon);

  const confirm = useConfirm();
  const prompt = usePrompt();

  const [menuListId, setMenuListId] = useState<string | null>(null);
  const [picker, setPicker] = useState<{ threatListId: string } | null>(null);

  // Order: seeded lists first (in the order they appear), then user lists
  // by createdAt ascending. Mirrors how Teams orders things (oldest first).
  const ordered = [...lists].sort((a, b) => {
    if (a.isSeed !== b.isSeed) return a.isSeed ? -1 : 1;
    return a.createdAt - b.createdAt;
  });

  async function handleCreate() {
    const name = await prompt('Name your threat list', {
      title: 'New threat list',
      placeholder: 'e.g. Locals to prep for',
    });
    if (!name || !name.trim()) return;
    const id = createThreatList({ name: name.trim(), format: 'any' });
    onSelectList(id);
    toast.success('Threat list created');
  }

  async function handleRename(list: ThreatList) {
    const next = await prompt('Rename threat list', {
      title: 'Rename',
      defaultValue: list.name,
    });
    if (next && next.trim() && next.trim() !== list.name) {
      renameThreatList(list.id, next.trim());
      toast.success('Renamed');
    }
  }

  function handleDuplicate(list: ThreatList) {
    const newId = duplicateThreatList(list.id);
    if (newId) {
      onSelectList(newId);
      toast.success('Duplicated');
    }
  }

  async function handleDelete(list: ThreatList) {
    const ok = await confirm(`"${list.name}" will be permanently deleted. This cannot be undone.`, {
      title: 'Delete threat list?',
      danger: true,
      okLabel: 'Delete',
    });
    if (!ok) return;
    deleteThreatList(list.id);
    if (selectedListId === list.id) {
      // Fall back to the first remaining list (after the delete).
      const remaining = lists.filter((l) => l.id !== list.id);
      onSelectList(remaining[0]?.id ?? '');
    }
    toast.success('Deleted');
  }

  async function handleRemoveMon(threatListId: string, mon: SavedMon) {
    const ok = await confirm(`${mon.species} will be removed from this list.`, { title: 'Remove from list?', danger: true, okLabel: 'Remove' });
    if (!ok) return;
    removeThreatMon(threatListId, mon.id);
    toast.success(`${mon.species} removed`);
  }

  const menuList = menuListId ? (lists.find((l) => l.id === menuListId) ?? null) : null;

  return (
    <section className="mb-5" data-testid="threat-list-picker">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-bold">Threat lists</h3>
        <button
          type="button"
          onClick={handleCreate}
          data-testid="threat-list-new"
          className="text-xs px-2.5 py-1.5 rounded-lg bg-accent text-white font-semibold"
        >
          + New
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {ordered.map((list) => (
          <ThreatListCard
            key={list.id}
            list={list}
            active={list.id === selectedListId}
            onSelect={() => onSelectList(list.id)}
            onMenu={() => setMenuListId(list.id)}
            onAddMon={() => setPicker({ threatListId: list.id })}
            onEditMon={(monId) => onEditThreatMon(list.id, monId)}
            onRemoveMon={(mon) => handleRemoveMon(list.id, mon)}
          />
        ))}
      </div>

      <PickerShell open={!!menuList} onClose={() => setMenuListId(null)} title={menuList?.name}>
        {menuList && (
          <div className="flex flex-col gap-1.5">
            <MenuButton
              onClick={() => {
                setMenuListId(null);
                handleRename(menuList);
              }}
            >
              Rename
            </MenuButton>
            <MenuButton
              onClick={() => {
                setMenuListId(null);
                handleDuplicate(menuList);
              }}
            >
              Duplicate
            </MenuButton>
            {!menuList.isSeed && (
              <MenuButton
                testId="threat-list-delete"
                tone="danger"
                onClick={() => {
                  setMenuListId(null);
                  handleDelete(menuList);
                }}
              >
                Delete
              </MenuButton>
            )}
            {menuList.isSeed && (
              <p className="text-xs opacity-55 italic px-1 mt-1">
                Seed lists ship with the app and can't be deleted. Duplicate to make a freely-editable copy.
              </p>
            )}
          </div>
        )}
      </PickerShell>

      {picker && (
        <SpeciesPicker
          open
          onClose={() => setPicker(null)}
          showRecents={false}
          onPick={(species) => {
            const mon = defaultOpponentMon(species);
            upsertThreatMon(picker.threatListId, mon);
            setPicker(null);
            onEditThreatMon(picker.threatListId, mon.id);
          }}
        />
      )}
    </section>
  );
}

function MenuButton({ onClick, tone, children, testId }: { onClick: () => void; tone?: 'danger'; children: React.ReactNode; testId?: string }) {
  const cls = tone === 'danger' ? 'bg-danger/10 border-danger/30 text-danger' : 'bg-surface border-surface-hi';
  return (
    <button onClick={onClick} data-testid={testId} className={`text-left px-3 py-2 rounded-lg border text-sm ${cls}`}>
      {children}
    </button>
  );
}

function ThreatListCard({
  list,
  active,
  onSelect,
  onMenu,
  onAddMon,
  onEditMon,
  onRemoveMon,
}: {
  list: ThreatList;
  active: boolean;
  onSelect: () => void;
  onMenu: () => void;
  onAddMon: () => void;
  onEditMon: (monId: string) => void;
  onRemoveMon: (mon: SavedMon) => void;
}) {
  return (
    <div
      data-testid={`threat-list-card${active ? '-active' : ''}`}
      data-list-id={list.id}
      className={`bg-surface border rounded-card p-3 ${active ? 'border-accent shadow-[0_0_24px_rgba(124,92,255,0.25)]' : 'border-surface-hi'}`}
    >
      <div className="flex items-center justify-between gap-2">
        <button onClick={onSelect} className="text-left flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm truncate">{list.name}</span>
            {/* Format pill is meaningful only for seed lists where it reflects
                a hand-curated meta context (singles vs doubles). User-created
                lists default to 'any' and have no editable format selector,
                so showing the pill there is just noise. */}
            {list.isSeed && <FormatPill format={list.format} />}
            {list.isSeed && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/15 text-accent border border-accent/30 uppercase tracking-wider font-semibold">
                seed
              </span>
            )}
          </div>
          <div className="text-[11px] opacity-55 mt-0.5">{list.mons.length} mons</div>
        </button>
        <button
          onClick={onMenu}
          aria-label="Threat list menu"
          data-testid={`threat-list-menu-${list.id}`}
          className="w-8 h-8 rounded-lg bg-surface border border-surface-hi text-base opacity-70 hover:opacity-100 shrink-0"
        >
          ⋯
        </button>
      </div>

      {active && (
        <div className="mt-3">
          <div className="flex flex-wrap gap-1.5">
            {list.mons.map((mon) => (
              <div
                key={mon.id}
                data-testid={`threat-mon-${mon.species}`}
                className="relative bg-bg-base/40 border border-surface-hi rounded-lg p-1.5 flex flex-col items-center gap-0.5"
              >
                <button type="button" onClick={() => onEditMon(mon.id)} aria-label={`Edit ${mon.species}`} className="flex flex-col items-center">
                  <img src={spriteUrl(mon.species)} className="w-10 h-10 object-contain" />
                  <span className="text-[10px] truncate max-w-[64px]">{mon.species}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveMon(mon)}
                  aria-label={`Remove ${mon.species}`}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-bg-base border border-surface-hi text-text-mute text-[10px] hover:text-danger hover:border-danger/40"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={onAddMon}
              data-testid="threat-mon-add"
              aria-label="Add Pokémon to threat list"
              className="w-[60px] h-[60px] flex items-center justify-center rounded-lg border border-dashed border-accent/30 text-accent text-xl"
            >
              +
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FormatPill({ format }: { format: ThreatList['format'] }) {
  // Color-coded so the format reads at a glance. Distinct from the seed
  // badge (which is accent/violet) so the two pills don't look like a
  // single bicolor smear: Singles -> warn yellow, Doubles -> priority
  // orange, Any -> ok green.
  const cls =
    format === 'singles'
      ? 'accent-2/15 text-accent-2 border-accent-2/30'
      : format === 'doubles'
        ? 'bg-priority/15 text-priority border-priority/30'
        : 'bg-ok/15 text-ok border-ok/30';
  const label = format === 'singles' ? 'Singles' : format === 'doubles' ? 'Doubles' : 'Any';
  return <span className={`text-[10px] px-1.5 py-0.5 rounded border uppercase tracking-wider font-semibold ${cls}`}>{label}</span>;
}
