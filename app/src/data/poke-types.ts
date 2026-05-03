/**
 * The 18 standard battle types in canonical order. Excludes the placeholder
 * "???" and the move-category "Status" type, which carry no meaningful
 * chart entries for coverage analysis.
 */
export const ALL_TYPES = [
  'Normal',
  'Fire',
  'Water',
  'Electric',
  'Grass',
  'Ice',
  'Fighting',
  'Poison',
  'Ground',
  'Flying',
  'Psychic',
  'Bug',
  'Rock',
  'Ghost',
  'Dragon',
  'Dark',
  'Steel',
  'Fairy',
] as const;

export type TypeName = (typeof ALL_TYPES)[number];
