import type { SavedMon, StatID, Team } from '@/types';

const STAT_LABEL: Record<StatID, string> = {
  hp: 'HP',
  atk: 'Atk',
  def: 'Def',
  spa: 'SpA',
  spd: 'SpD',
  spe: 'Spe',
};

const STAT_ORDER: StatID[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

function speciesWithMega(mon: SavedMon): string {
  if (!mon.mega) return mon.species;
  if (mon.species.endsWith('-Mega') || mon.species.includes('-Mega-')) return mon.species;
  if (mon.mega === 'mega-x') return `${mon.species}-Mega-X`;
  if (mon.mega === 'mega-y') return `${mon.species}-Mega-Y`;
  return `${mon.species}-Mega`;
}

export function monToShowdownText(mon: SavedMon): string {
  const lines: string[] = [];
  const head = mon.item ? `${speciesWithMega(mon)} @ ${mon.item}` : speciesWithMega(mon);
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
