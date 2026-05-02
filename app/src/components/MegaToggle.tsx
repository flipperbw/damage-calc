import { Generations } from '@smogon/calc';

const GEN = Generations.get(0);

export function hasMegaForme(species: string): boolean {
  const baseName = species.replace(/-Mega(-X|-Y)?$/, '');
  const megaCandidates = [`${baseName}-Mega`, `${baseName}-Mega-X`, `${baseName}-Mega-Y`];
  return megaCandidates.some(c => !!GEN.species.get(c as any));
}

interface Props {
  isMega: boolean;
  onChange: (next: boolean) => void;
  species: string;
}

export function MegaToggle({ isMega, onChange, species }: Props) {
  if (!hasMegaForme(species)) return null;
  return (
    <button onClick={() => onChange(!isMega)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border ${isMega ? 'bg-accent-gradient text-white border-accent' : 'bg-surface border-surface-hi opacity-70'}`}>
      {isMega ? '✦ Mega Active' : 'Mega Evolve'}
    </button>
  );
}
