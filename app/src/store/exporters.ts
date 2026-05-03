import { megaFormeName } from '@/calc/helpers';
import { STAT_LABEL, STAT_ORDER, type SavedMon, type Team } from '@/types';

export function monToShowdownText(mon: SavedMon): string {
  const lines: string[] = [];
  const speciesName = megaFormeName(mon.species, mon.mega);
  const head = mon.item ? `${speciesName} @ ${mon.item}` : speciesName;
  lines.push(head);
  if (mon.ability) lines.push(`Ability: ${mon.ability}`);
  lines.push(`Level: 50`);
  // SP allocation; emit as EVs in PS-style line if any non-zero stats.
  const evParts = STAT_ORDER.filter((s) => (mon.sps[s] ?? 0) > 0).map((s) => `${mon.sps[s]} ${STAT_LABEL[s]}`);
  if (evParts.length > 0) lines.push(`EVs: ${evParts.join(' / ')}`);
  if (mon.nature) lines.push(`${mon.nature} Nature`);
  for (const move of mon.moves) {
    if (move) lines.push(`- ${move}`);
  }
  return lines.join('\n');
}

export function teamToShowdownText(team: Team): string {
  if (team.mons.length === 0) return `=== ${team.name} ===\n(empty team)`;
  const blocks = team.mons.map(monToShowdownText);
  return `=== ${team.name} ===\n\n${blocks.join('\n\n')}`;
}
