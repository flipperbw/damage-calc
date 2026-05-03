import { useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import { useStore } from './store';
import { Nav } from './components/Nav';
import { BattleScreen } from './screens/BattleScreen';
import { TeamsScreen } from './screens/TeamsScreen';
import { BuilderScreen } from './screens/BuilderScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { ConfirmProvider } from './components/ConfirmDialog';
import { preloadPkmn } from './data/pkmn';

/**
 * The 900px breakpoint matches the existing mobile CSS media query in
 * globals.css. Below 900 we treat the device as a phone — toast position
 * top-center so it doesn't fight the bottom nav and stays in the user's
 * thumb sightline. At desktop widths we drop it bottom-right so it doesn't
 * cover the active battle card.
 */
function useIsMobile() {
  const [mobile, setMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 899px)').matches;
  });
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 899px)');
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return mobile;
}

export function App() {
  const tab = useStore(s => s.tab);
  const isMobile = useIsMobile();
  // Fire-and-forget preload of @pkmn/data so the move picker's learnset
  // filter and the move detail sheet's prose are warm by the time the
  // user opens them. The dynamic import + learnset chunk together weigh
  // ~3.5 MB raw / ~600 KB gzipped, so we don't await — initial render
  // proceeds immediately and the data trickles in.
  useEffect(() => { void preloadPkmn(); }, []);
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
      <Toaster
        position={isMobile ? 'top-center' : 'bottom-right'}
        theme="dark"
        richColors
        closeButton={false}
        // Stay just under the iOS notch on mobile.
        offset={isMobile ? 'calc(env(safe-area-inset-top, 0px) + 12px)' : undefined}
      />
    </ConfirmProvider>
  );
}
