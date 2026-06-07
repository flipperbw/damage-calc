import CHANGELOG_SOURCE from '@/content/CHANGELOG.md?raw';

/**
 * Extracts the most recent `## heading` from a CHANGELOG.md source. Drives
 * the unread indicator: when this differs from the persisted
 * lastSeenChangelogHeading, the user has changes they haven't read.
 *
 * Computed once at module load - CHANGELOG.md ships in the bundle, so the
 * "latest" entry only changes between deploys, never at runtime.
 */
function latestChangelogHeading(source: string): string | null {
  for (const line of source.split(/\r?\n/)) {
    const t = line.trim();
    if (t.startsWith('## ')) return t.slice(3).trim();
  }
  return null;
}

export const LATEST_CHANGELOG_HEADING: string | null = latestChangelogHeading(CHANGELOG_SOURCE);
export { CHANGELOG_SOURCE };
