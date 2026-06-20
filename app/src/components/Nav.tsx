import type { MouseEvent } from 'react';

import { Logo } from '@/components/Logo';
import { RegulationBadge } from '@/components/RegulationBadge';
import { LATEST_CHANGELOG_HEADING } from '@/data/changelog';
import { useStore } from '@/store';
import type { Tab } from '@/types';

// `iconOnlyMobile` tabs hide their text label on mobile only, where the row
// is otherwise too cramped. Desktop has plenty of space and reads better
// with the full word.
const ITEMS: Array<{ id: Tab; icon: string; label: string; iconOnlyMobile?: boolean }> = [
  { id: 'battle', icon: '⚔', label: 'Battle' },
  { id: 'teams', icon: '👥', label: 'Teams' },
  { id: 'builder', icon: '🧪', label: 'Builder' },
  { id: 'settings', icon: '⚙', label: 'Settings', iconOnlyMobile: true },
];

// Render tabs as <a href="#/<tab>"> so middle-click / ctrl-click / cmd-click
// open the same tab in a new browser tab natively. On a plain left-click we
// preventDefault and route in-app via setTab(); modifier-clicks and aux
// buttons fall through to the browser's default anchor behaviour. The hash
// is the same one App's useTabRoute parses on boot, so the new tab lands on
// the right screen without any extra glue.
function tabHref(tab: Tab): string {
  return `#/${tab}`;
}

function handleTabClick(e: MouseEvent<HTMLAnchorElement>, setTab: (t: Tab) => void, target: Tab) {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  setTab(target);
}

export function Nav() {
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  // Pulse a small dot on the Settings tab when CHANGELOG.md has an entry
  // newer than the one the user last dismissed. The Settings screen owns
  // the "mark as seen" action - opening "What's new" there clears it.
  const lastSeenChangelogHeading = useStore((s) => s.lastSeenChangelogHeading);
  const hasUnseenChangelog = !!LATEST_CHANGELOG_HEADING && lastSeenChangelogHeading !== LATEST_CHANGELOG_HEADING;
  return (
    <>
      {/* Mobile: icon-only brand + label-only tabs (no leading emoji) so
          each tab gets the full available width for its name and the row
          doesn't feel cramped. Tab labels are short enough that this
          works at iPhone-SE widths too. */}
      <div className="md:hidden flex items-center gap-2 mb-3">
        <a
          href={tabHref('battle')}
          onClick={(e) => handleTabClick(e, setTab, 'battle')}
          aria-label="FutureSight — home"
          className="relative min-w-[44px] min-h-[44px] flex items-center justify-center select-none shrink-0"
          style={{ touchAction: 'manipulation' }}
        >
          <Logo className="w-7 h-7" />
          <RegulationBadge className="absolute bottom-0 -right-0.5 text-[7px] leading-none px-0.5 py-px" />
        </a>
        <nav aria-label="Primary" className="mobile-nav flex-1 grid grid-cols-4 gap-1.5">
          {ITEMS.map((it) => (
            <a
              key={it.id}
              href={tabHref(it.id)}
              onClick={(e) => handleTabClick(e, setTab, it.id)}
              aria-label={it.label + (it.id === 'settings' && hasUnseenChangelog ? ' (unread changelog)' : '')}
              style={{ touchAction: 'manipulation' }}
              className={`relative min-h-[44px] flex items-center justify-center rounded-lg text-[13px] font-semibold select-none transition-colors no-underline ${
                tab === it.id
                  ? 'bg-accent-gradient text-white shadow-[0_2px_10px_rgba(124,92,255,0.35)]'
                  : 'bg-surface border border-surface-hi text-text-mute hover:text-text'
              }`}
            >
              <span style={{ pointerEvents: 'none' }} className={it.iconOnlyMobile ? 'text-base leading-none' : ''}>
                {it.iconOnlyMobile ? it.icon : it.label}
              </span>
              {/* {it.id === 'settings' && hasUnseenChangelog && <UnreadDot />} */}
            </a>
          ))}
        </nav>
      </div>
      {/* Desktop: brand + name visible inline before the tabs. Wordmark
          weight (font-semibold) and size (text-sm) match the tab labels so
          the brand reads as part of the same nav strip, not a separate
          heading floating beside it. */}
      <div className="hidden md:flex items-center gap-3 mb-4">
        <a
          href={tabHref('battle')}
          onClick={(e) => handleTabClick(e, setTab, 'battle')}
          aria-label="FutureSight — home"
          className="flex items-center gap-2 px-1 py-1 rounded-lg hover:opacity-90 no-underline text-text"
        >
          <Logo className="w-7 h-7" />
          <span className="font-semibold tracking-tight text-sm">FutureSight</span>
          <RegulationBadge className="text-[9px] px-1 py-0.5" />
        </a>
        <nav className="flex gap-1">
          {ITEMS.map((it) => (
            <a
              key={it.id}
              href={tabHref(it.id)}
              onClick={(e) => handleTabClick(e, setTab, it.id)}
              aria-label={it.id === 'settings' && hasUnseenChangelog ? `${it.label} (unread changelog)` : undefined}
              className={`relative px-4 py-2 rounded-lg text-sm no-underline ${tab === it.id ? 'bg-accent-gradient text-white' : 'bg-surface border border-surface-hi opacity-70 text-text'}`}
            >
              <span className="mr-1.5">{it.icon}</span>
              {it.label}
              {/* {it.id === 'settings' && hasUnseenChangelog && <UnreadDot />} */}
            </a>
          ))}
        </nav>
      </div>
    </>
  );
}

// Temporarily disabled. Mantine-style indicator: solid colored disc that
// overlaps the corner of its host (half-inside, half-outside) so it reads as
// a separate notification mark rather than a chip stuck inside. To re-enable,
// uncomment the JSX call sites above (the `{it.id === 'settings' &&
// hasUnseenChangelog && <UnreadDot />}` lines) and this function body.
//
// function UnreadDot() {
//   return (
//     <span
//       aria-hidden
//       data-testid="unread-changelog-dot"
//       className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-ok shadow"
//     />
//   );
// }
