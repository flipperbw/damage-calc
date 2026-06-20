import { describe, expect, it } from 'vitest';

import { autoSpreadFromMoves, synthesizeBuild } from '@/store/synthesize';

describe('synthesizeBuild', () => {
  it('fast mons (Garchomp) get a max-speed offensive layout', async () => {
    const built = await synthesizeBuild('Garchomp');
    expect(built).not.toBeNull();
    // Garchomp base spe = 102 → fast → spe maxed, hp 2.
    expect(built!.sps.spe).toBe(32);
    expect(built!.sps.hp).toBe(2);
    expect(built!.sps.def ?? 0).toBe(0);
    expect(built!.sps.spd ?? 0).toBe(0);
  });

  it('slow mons (Tyranitar) get a bulk-leaning layout instead of speed', async () => {
    const built = await synthesizeBuild('Tyranitar');
    expect(built).not.toBeNull();
    // Tyranitar base spe = 61 → slow → no spe investment, HP=18, def-or-spd=16.
    expect(built!.sps.spe ?? 0).toBe(0);
    expect(built!.sps.hp).toBe(18);
    const def = built!.sps.def ?? 0;
    const spd = built!.sps.spd ?? 0;
    expect(def + spd).toBe(16);
    expect(def === 16 || spd === 16).toBe(true);
  });
});

describe('autoSpreadFromMoves', () => {
  it('picks the attacking stat from the build moves, not the species', () => {
    // Charizard leans special by base stats, but a physical-move set should
    // still get a physical spread (this is the mega X/Y safety net).
    const phys = autoSpreadFromMoves('Charizard', ['Dragon Claw', 'Flare Blitz', 'Protect', '']);
    expect(phys.atk ?? 0).toBeGreaterThan(0);
    expect(phys.spa ?? 0).toBe(0);

    const spec = autoSpreadFromMoves('Charizard', ['Heat Wave', 'Air Slash', 'Protect', '']);
    expect(spec.spa ?? 0).toBeGreaterThan(0);
    expect(spec.atk ?? 0).toBe(0);
  });
});
