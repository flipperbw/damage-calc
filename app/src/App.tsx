import { useStore } from './store';
import { Nav } from './components/Nav';
import { BattleScreen } from './screens/BattleScreen';
import { TeamsScreen } from './screens/TeamsScreen';
import { SettingsScreen } from './screens/SettingsScreen';

export function App() {
  const tab = useStore(s => s.tab);
  return (
    <div className="min-h-screen bg-bg-base bg-panel-gradient text-text">
      <main className="app-shell max-w-[1200px] mx-auto px-3.5 md:pt-3.5 md:pb-6">
        <Nav />
        {tab === 'battle' && <BattleScreen />}
        {tab === 'teams' && <TeamsScreen />}
        {tab === 'settings' && <SettingsScreen />}
      </main>
    </div>
  );
}
