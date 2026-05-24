import { useEffect } from 'react';
import { Toaster } from 'sonner';

import { ConfirmProvider } from '@/components/ConfirmDialog';
import { Nav } from '@/components/Nav';
import { BattleScreen } from '@/screens/BattleScreen';
import { BuilderScreen } from '@/screens/BuilderScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { TeamsScreen } from '@/screens/TeamsScreen';
import { useStore } from '@/store';
import type { Tab } from '@/types';

const VALID_TABS: readonly Tab[] = ['battle', 'teams', 'builder', 'settings'];

/**
 * Hash-based routing for the four primary tabs. Why hash, not pathname?
 *   - The app ships as a static SPA; hash routing works without server
 *     rewrites.
 *   - Hash changes don't trigger page navigation, so we get back/forward
 *     stack integration for free without a router library.
 *   - `popstate` fires on back/forward; we sync the store from the new hash.
 *   - When the store's `tab` changes (e.g. via a Nav button click), we
 *     pushState a new hash so the back button can return.
 *
 * Initial sync: the hash wins on first load if it names a valid tab; the
 * persisted store value is the fallback otherwise.
 */
function useTabRoute() {
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);

  // Initial sync from URL → store.
  useEffect(() => {
    const fromHash = parseTab(window.location.hash);
    if (fromHash && fromHash !== tab) {
      setTab(fromHash);
    } else if (!fromHash) {
      // Persisted state had a tab but the hash is empty - write it so the
      // URL reflects the current view from the get-go.
      replaceHash(tab);
    }
    // Listen for back/forward navigation.
    const onPop = () => {
      const t = parseTab(window.location.hash);
      if (t) setTab(t);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only run once
  }, []);

  // Push a new hash entry whenever the store's tab moves. Skip if the hash
  // is already in sync (popstate path).
  useEffect(() => {
    const current = parseTab(window.location.hash);
    if (current === tab) return;
    pushHash(tab);
  }, [tab]);
}

function parseTab(hash: string): Tab | null {
  // Accept both "#builder" and "#/builder" forms.
  const stripped = hash.replace(/^#\/?/, '');
  return VALID_TABS.includes(stripped as Tab) ? (stripped as Tab) : null;
}

const TAB_TITLES: Record<Tab, string> = {
  battle: 'Battle',
  teams: 'Teams',
  builder: 'Builder',
  settings: 'Settings',
};

function useTabPageTitle(tab: Tab) {
  useEffect(() => {
    document.title = `${TAB_TITLES[tab]} · FutureSight`;
  }, [tab]);
}

function pushHash(tab: Tab) {
  window.history.pushState(null, '', `#/${tab}`);
}

function replaceHash(tab: Tab) {
  window.history.replaceState(null, '', `#/${tab}`);
}

export function App() {
  const tab = useStore((s) => s.tab);
  // @pkmn/data preload is now triggered lazily by the first `usePkmnReady`
  // consumer (MovePicker, AbilityPicker, move/ability detail sheets) so we
  // don't allocate ~250KB of dex data on initial mount. iOS WKWebView is
  // tight on background-tab heap; smaller initial heap means longer tab
  // survival when the user app-switches away.
  useTabRoute();
  useTabPageTitle(tab);
  return (
    <ConfirmProvider>
      <div className="min-h-screen bg-bg-base bg-panel-gradient text-text">
        <main className="app-shell max-w-[1200px] mx-auto px-3.5 md:pt-3.5 md:pb-6">
          <Nav />
          {tab === 'battle' && <BattleScreen />}
          {tab === 'teams' && <TeamsScreen />}
          {tab === 'builder' && <BuilderScreen />}
          {tab === 'settings' && <SettingsScreen />}
        </main>
      </div>
      <Toaster position="bottom-left" theme="dark" richColors closeButton={false} />
    </ConfirmProvider>
  );
}
