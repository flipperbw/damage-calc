export const TYPE_COLORS: Record<string, string> = {
  Normal:   '#a8a878',
  Fire:     '#fa5252',
  Water:    '#339af0',
  Electric: '#f7c948',
  Grass:    '#84cc16',
  Ice:      '#7ad3de',
  Fighting: '#c92a2a',
  Poison:   '#a560b8',
  Ground:   '#d4a373',
  Flying:   '#748ffc',
  Psychic:  '#f06595',
  Bug:      '#9bc53d',
  Rock:     '#a47551',
  Ghost:    '#7048a8',
  Dragon:   '#6b5bff',
  Dark:     '#444444',
  Steel:    '#6c7a89',
  Fairy:    '#f7a8d8',
  '???':    '#888888',
  Status:   '#888888',
};

export function colorForType(type: string | undefined): string {
  if (!type) return TYPE_COLORS['???'];
  return TYPE_COLORS[type] ?? TYPE_COLORS['???'];
}
