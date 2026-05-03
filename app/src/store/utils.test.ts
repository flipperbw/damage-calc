import { describe, expect, it } from 'vitest';

import { deleteById, duplicateById, removeChild, renameById, upsertChild } from '@/store/utils';

interface Parent {
  id: string;
  name: string;
  updatedAt: number;
  mons: { id: string; species: string }[];
}

const p = (over: Partial<Parent> = {}): Parent => ({
  id: 'p1',
  name: 'Parent',
  updatedAt: 0,
  mons: [],
  ...over,
});

describe('store/utils', () => {
  it('renameById sets name and bumps updatedAt only on the matching entry', () => {
    const arr = [p({ id: 'a', name: 'A' }), p({ id: 'b', name: 'B' })];
    const out = renameById(arr, 'b', 'B-renamed');
    expect(out[0]).toBe(arr[0]); // untouched
    expect(out[1].name).toBe('B-renamed');
    expect(out[1].updatedAt).toBeGreaterThan(0);
  });

  it('deleteById drops the matching entry', () => {
    const arr = [p({ id: 'a' }), p({ id: 'b' })];
    expect(deleteById(arr, 'a')).toEqual([arr[1]]);
    expect(deleteById(arr, 'missing')).toEqual(arr);
  });

  it('duplicateById returns null when id is unknown', () => {
    expect(duplicateById([p({ id: 'a' })], 'missing', (o) => ({ ...o, id: 'x' }))).toBeNull();
  });

  it('upsertChild appends or replaces by child id and bumps updatedAt', () => {
    const arr = [p({ id: 'p1', mons: [{ id: 'm1', species: 'A' }] })];
    const appended = upsertChild(arr, 'p1', { id: 'm2', species: 'B' });
    expect(appended[0].mons).toHaveLength(2);
    expect(appended[0].updatedAt).toBeGreaterThan(0);
    const replaced = upsertChild(arr, 'p1', { id: 'm1', species: 'A2' });
    expect(replaced[0].mons).toHaveLength(1);
    expect(replaced[0].mons[0].species).toBe('A2');
  });

  it('removeChild filters by child id and bumps updatedAt; non-matching parents untouched', () => {
    const arr = [p({ id: 'p1', mons: [{ id: 'm1', species: 'A' }] }), p({ id: 'p2', mons: [{ id: 'm1', species: 'X' }] })];
    const out = removeChild(arr, 'p1', 'm1');
    expect(out[0].mons).toEqual([]);
    expect(out[1]).toBe(arr[1]);
  });
});
