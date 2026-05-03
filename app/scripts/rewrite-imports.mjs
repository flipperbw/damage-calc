#!/usr/bin/env node
// One-off codemod: rewrite relative imports under src/ to use the `@/` alias.
//
// Walks app/src/**/*.{ts,tsx}, finds every `from '../...'` and `from './...'`,
// resolves the target against the file's directory, and rewrites it to
// `@/<path-relative-to-src>` if the target falls inside src/.
//
// Imports of files outside src/ (defensive — there shouldn't be any) and
// node/module-style imports are left alone. Run from app/:
//   node scripts/rewrite-imports.mjs

import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join, dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(__dirname, '..');
const SRC_ROOT = resolve(APP_ROOT, 'src');

async function walk(dir) {
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full)));
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(full);
  }
  return out;
}

// Try to resolve `spec` (relative to fileDir) to an actual file under SRC_ROOT.
// Returns the alias path (`@/foo/bar`) or null if it can't be resolved or
// falls outside src/.
function resolveAlias(fileDir, spec) {
  const candidates = [
    spec,
    `${spec}.ts`,
    `${spec}.tsx`,
    `${spec}/index.ts`,
    `${spec}/index.tsx`,
  ];
  for (const c of candidates) {
    const abs = resolve(fileDir, c);
    try {
      const s = statSync(abs);
      if (s.isFile()) {
        const rel = relative(SRC_ROOT, abs).split(sep).join('/');
        if (rel.startsWith('..')) return null;
        // Strip extension; bundlers and tsc handle ext-less imports.
        let clean = rel.replace(/\.(tsx?|jsx?)$/, '');
        // Drop trailing /index — `@/store/index` and `@/store` resolve to
        // the same file, but the bare form reads better.
        clean = clean.replace(/\/index$/, '');
        return `@/${clean}`;
      }
    } catch {
      // not a file
    }
  }
  return null;
}

// Match the specifier of `from '...'`, `from "..."`, and dynamic `import('...')`.
// We rewrite only relative specifiers that start with `./` or `../`.
const RE = /(from\s+|import\(\s*)(['"])(\.{1,2}\/[^'"]*)\2/g;

let totalFiles = 0;
let changedFiles = 0;
let totalEdits = 0;

const files = await walk(SRC_ROOT);
for (const file of files) {
  totalFiles++;
  const before = readFileSync(file, 'utf8');
  const fileDir = dirname(file);
  let edits = 0;
  const after = before.replace(RE, (full, kw, q, spec) => {
    const alias = resolveAlias(fileDir, spec);
    if (!alias) return full;
    edits++;
    return `${kw}${q}${alias}${q}`;
  });
  if (edits > 0) {
    writeFileSync(file, after);
    changedFiles++;
    totalEdits += edits;
  }
}

console.log(
  `Scanned ${totalFiles} files, rewrote ${totalEdits} imports across ${changedFiles} files.`,
);
