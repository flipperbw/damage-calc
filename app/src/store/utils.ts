/**
 * Pure helpers shared between the Team and ThreatList CRUD actions in the
 * store. The public action surface (renameTeam, renameThreatList, …) is kept
 * intact for devtools clarity; these helpers just dedupe the array-shaping
 * code each action used to inline.
 */

/** Replace `name` (and bump `updatedAt`) on the entry whose id matches. */
export function renameById<T extends { id: string; name: string; updatedAt: number }>(arr: T[], id: string, name: string): T[] {
  return arr.map((x) => (x.id === id ? { ...x, name, updatedAt: Date.now() } : x));
}

/** Drop the entry whose id matches; non-matching entries are returned as-is. */
export function deleteById<T extends { id: string }>(arr: T[], id: string): T[] {
  return arr.filter((x) => x.id !== id);
}

/**
 * Append a freshly-cloned entry built by `clone()` to `arr`. Returns the
 * extended array plus the cloned entry, or `null` if no parent matched.
 * Callers compose their own clone (Team copy clears nothing extra; ThreatList
 * copy clears `isSeed`), keeping the per-collection invariants at the call
 * site instead of inside this helper.
 */
export function duplicateById<T extends { id: string }>(arr: T[], id: string, clone: (orig: T) => T): { arr: T[]; clone: T } | null {
  const orig = arr.find((x) => x.id === id);
  if (!orig) return null;
  const copy = clone(orig);
  return { arr: [...arr, copy], clone: copy };
}

/**
 * Replace the child whose id matches inside the parent whose id matches; if
 * no child with that id exists, append. Bumps the parent's `updatedAt`.
 */
export function upsertChild<P extends { id: string; updatedAt: number; mons: C[] }, C extends { id: string }>(
  parents: P[],
  parentId: string,
  child: C,
): P[] {
  return parents.map((p) => {
    if (p.id !== parentId) return p;
    const idx = p.mons.findIndex((m) => m.id === child.id);
    const mons = idx >= 0 ? p.mons.map((m) => (m.id === child.id ? child : m)) : [...p.mons, child];
    return { ...p, mons, updatedAt: Date.now() };
  });
}

/** Remove the child whose id matches inside the parent whose id matches; bumps `updatedAt`. */
export function removeChild<P extends { id: string; updatedAt: number; mons: { id: string }[] }>(parents: P[], parentId: string, childId: string): P[] {
  return parents.map((p) => (p.id === parentId ? { ...p, mons: p.mons.filter((m) => m.id !== childId), updatedAt: Date.now() } : p));
}
