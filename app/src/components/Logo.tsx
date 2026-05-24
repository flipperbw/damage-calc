import { useId } from 'react';

interface Props {
  /** Tailwind sizing classes — e.g. `w-7 h-7`. */
  className?: string;
}

/**
 * FutureSight brand mark — a 4-point sparkle in the app's accent gradient.
 * Render with Tailwind size classes (e.g. <Logo className="w-7 h-7" />)
 * for both width and height so the SVG doesn't collapse against the
 * preflight `svg { display: block }` rule.
 *
 * The gradient id is per-instance via React.useId so when both the mobile
 * and desktop Nav variants render at the same time (one hidden, one
 * visible, both still in the DOM), `url(#id)` references don't collide
 * across instances — a single shared id resolves to whichever SVG's
 * gradient happens to be in a hidden subtree first, which leaves the
 * visible logo with an unresolved fill.
 */
export function Logo({ className = 'w-7 h-7' }: Props) {
  const id = useId();
  const gradientId = `futuresight-mark-${id}`;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7c5cff" />
          <stop offset="1" stopColor="#5c8cff" />
        </linearGradient>
      </defs>
      {/* Concave-cusped 4-point sparkle — same curvature on each axis so
          the silhouette reads cleanly at favicon sizes too. */}
      <path
        d="M16 3 Q17 14 28 16 Q17 18 16 29 Q15 18 4 16 Q15 14 16 3 Z"
        fill={`url(#${gradientId})`}
      />
    </svg>
  );
}
