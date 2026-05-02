import { useStore } from './store';
import { Nav } from './components/Nav';
import { BattleScreen } from './screens/BattleScreen';

export function App() {
  const tab = useStore(s => s.tab);
  return (
    <div className="min-h-screen bg-bg-base bg-panel-gradient text-text">
      <main className="max-w-[1200px] mx-auto px-3.5 pt-3.5 pb-24 md:pb-6">
        <Nav />
        {tab === 'battle' && <BattleScreen />}
        {tab === 'teams' && <div>Teams (TBD)</div>}
        {tab === 'settings' && <div>Settings (TBD)</div>}
      </main>
    </div>
  );
}
