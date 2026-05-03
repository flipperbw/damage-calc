// Slug used by play.pokemonshowdown.com sprite paths. Lowercase, no spaces or punctuation
// except a few preserved hyphens for forme suffixes.
function spriteSlug(species: string): string {
  return species
    .toLowerCase()
    .replace(/[\s.'’]+/g, '')
    .replace(/-mega(-x|-y)?$/, (m) => m.toLowerCase());
}

export function spriteUrl(species: string): string {
  return `https://play.pokemonshowdown.com/sprites/dex/${spriteSlug(species)}.png`;
}
