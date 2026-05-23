import { spriteUrl } from '@/data/sprites';

interface Props {
  species: string;
  /** Image alt text. Defaults to empty (decorative). */
  alt?: string;
  /**
   * Classes applied to the outer container. Sizing (`w-N h-N` or
   * `w-3/4 h-3/4`) and corner rounding live here; the inner image fills
   * the container.
   */
  className?: string;
}

/**
 * Locally-bundled dex sprite. The PNGs under `public/sprites/` were
 * pre-processed by `scripts/process-sprites.mjs` — trimmed of their
 * transparent padding and re-canvased to a uniform 100×100 with a small
 * built-in margin — so this component is a plain `<img>` with no runtime
 * transform. Add padding on the caller's container if you want extra
 * breathing room.
 */
export function Sprite({ species, alt = '', className = '' }: Props) {
  return (
    <img
      src={spriteUrl(species)}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={`object-contain ${className}`}
    />
  );
}
