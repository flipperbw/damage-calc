// PS dex sprite naming has two patterns:
//   1. Intrinsic-hyphen names (Kommo-o, Porygon-Z, Mr. Mime, Ho-Oh) — every
//      hyphen / dot / colon / space is stripped, producing a flat lowercase
//      id (`kommoo`, `porygonz`, `mrmime`, `hooh`).
//   2. Forme names (Garchomp-Mega, Tauros-Paldea-Aqua, Aegislash-Blade) —
//      the first hyphen marks the species / forme boundary and is kept; any
//      later hyphens are collapsed (Tauros-Paldea-Aqua → `tauros-paldeaaqua`).
//
// The old slug function only stripped whitespace/punctuation, which produced
// `kommo-o.png` (404) and `tauros-paldea-aqua.png` (404). The new rule below
// matches what `play.pokemonshowdown.com/sprites/dex/` actually serves.

const INTRINSIC_HYPHEN_NAMES: Record<string, string> = {
  'Kommo-o': 'kommoo',
  'Jangmo-o': 'jangmoo',
  'Hakamo-o': 'hakamoo',
  'Porygon-Z': 'porygonz',
  'Ho-Oh': 'hooh',
  'Mr. Mime': 'mrmime',
  'Mr. Rime': 'mrrime',
  'Mime Jr.': 'mimejr',
  'Type: Null': 'typenull',
};

function spriteSlug(species: string): string {
  const intrinsic = INTRINSIC_HYPHEN_NAMES[species];
  if (intrinsic) return intrinsic;
  // Strip everything except lowercase a-z, digits, and hyphens. Then keep the
  // first hyphen as the species/forme boundary and collapse the rest.
  const lower = species.toLowerCase().replace(/[^a-z0-9-]/g, '');
  const idx = lower.indexOf('-');
  if (idx < 0) return lower;
  return lower.slice(0, idx + 1) + lower.slice(idx + 1).replace(/-/g, '');
}

export function spriteUrl(species: string): string {
  return `https://play.pokemonshowdown.com/sprites/dex/${spriteSlug(species)}.png`;
}
