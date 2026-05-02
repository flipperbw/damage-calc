import { useStore } from '../store';

export function SettingsScreen() {
  const notation = useStore(s => s.notation);
  const setNotation = useStore(s => s.setNotation);
  const clearAllRecents = useStore(s => s.clearAllRecents);
  const resetAll = useStore(s => s.resetAll);

  function exportJson() {
    const blob = new Blob([JSON.stringify(useStore.getState(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `champions-calc-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importJson() {
    const file = await pickFile();
    if (!file) return;
    const text = await file.text();
    try {
      const parsed = JSON.parse(text);
      useStore.setState(parsed);
    } catch (e) {
      alert('Invalid file');
    }
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Settings</h2>

      <Section title="Notation">
        <Toggle value={notation === 'percent'} onClick={() => setNotation('percent')} label="100%" />
        <Toggle value={notation === 'pixels'} onClick={() => setNotation('pixels')} label="48ths" />
      </Section>

      <Section title="Data">
        <Action label="Export all data" onClick={exportJson} />
        <Action label="Import data" onClick={importJson} />
        <Action label="Clear recent opponents" onClick={clearAllRecents} />
        <Action label="Reset everything" tone="danger" onClick={() => {
          if (confirm('Wipe all teams, recents, and settings?')) resetAll();
        }} />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="text-xxs uppercase tracking-wider opacity-55 mb-2">{title}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Toggle({ value, onClick, label }: { value: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick}
            className={`px-3 py-1.5 rounded-lg text-sm ${value ? 'bg-accent-gradient text-white' : 'bg-surface border border-surface-hi opacity-70'}`}>
      {label}
    </button>
  );
}

function Action({ label, onClick, tone }: { label: string; onClick: () => void; tone?: 'danger' }) {
  const c = tone === 'danger' ? 'bg-danger/10 border-danger/30 text-danger' : 'bg-surface border-surface-hi';
  return <button onClick={onClick} className={`w-full text-left px-3 py-2 rounded-lg border ${c} text-sm`}>{label}</button>;
}

function pickFile(): Promise<File | null> {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}
