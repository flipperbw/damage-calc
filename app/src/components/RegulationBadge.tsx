import { CURRENT_REGULATION } from '@/data/regulation';

interface Props {
  /** Extra classes for sizing/positioning (font size, padding, absolute pos). */
  className?: string;
}

/**
 * Small chip showing the active Champions regulation (e.g. "M-B"), rendered
 * beside the site logo. Subtle accent-tinted pill so it reads as a status
 * marker, not a nav action. Label comes from CURRENT_REGULATION.
 */
export function RegulationBadge({ className = '' }: Props) {
  return (
    <span
      aria-label={`Regulation ${CURRENT_REGULATION}`}
      title={`Pokémon Champions — Regulation ${CURRENT_REGULATION}`}
      className={`inline-flex items-center justify-center rounded font-bold uppercase tracking-wide bg-accent/15 text-accent border border-accent/30 select-none ${className}`}
    >
      {CURRENT_REGULATION}
    </span>
  );
}
