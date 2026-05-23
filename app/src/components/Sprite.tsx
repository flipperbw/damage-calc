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
      // `image-rendering: -webkit-optimize-contrast` hints to WebKit /
      // Chrome to prefer sharper downscaling kernels (closer to bilinear-
      // sharp than the default lanczos-blur). PS dex art is mostly clean
      // shading with hard outlines — this keeps the outlines crisp when
      // the browser downscales our 100×100 source to ~32–64px display
      // sizes. Firefox ignores the value and uses its default (fine).
      style={{ imageRendering: '-webkit-optimize-contrast' }}
      className={`object-contain ${className}`}
    />
  );
}
