import { Fragment } from 'react';

/**
 * Minimal markdown → React renderer. Covers just the subset used by
 * CHANGELOG.md / ROADMAP.md:
 *
 *   ## heading       → h3
 *   ### heading      → h4
 *   - bullet         → ul / li (consecutive lines group)
 *   **bold**         → <strong>
 *   blank line       → paragraph break
 *   anything else    → paragraph
 *
 * No HTML escaping risk because we never call dangerouslySetInnerHTML —
 * inline parsing emits React text/element nodes directly. If we ever
 * want links, code spans, or images we should switch to `marked` or
 * `markdown-it`; until then a 50KB dep would be overkill.
 */

interface Props {
  source: string;
  className?: string;
}

type Block =
  | { kind: 'h3'; text: string }
  | { kind: 'h4'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'p'; text: string };

function parse(source: string): Block[] {
  const lines = source.split(/\r?\n/);
  const blocks: Block[] = [];
  let buffer: string[] = [];

  const flushPara = () => {
    if (buffer.length === 0) return;
    blocks.push({ kind: 'p', text: buffer.join(' ').trim() });
    buffer = [];
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed === '') {
      flushPara();
      i++;
      continue;
    }
    if (trimmed.startsWith('### ')) {
      flushPara();
      blocks.push({ kind: 'h4', text: trimmed.slice(4) });
      i++;
      continue;
    }
    if (trimmed.startsWith('## ')) {
      flushPara();
      blocks.push({ kind: 'h3', text: trimmed.slice(3) });
      i++;
      continue;
    }
    if (trimmed.startsWith('- ')) {
      flushPara();
      const items: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('- ')) {
        items.push(lines[i].trim().slice(2));
        i++;
      }
      blocks.push({ kind: 'list', items });
      continue;
    }
    buffer.push(trimmed);
    i++;
  }
  flushPara();
  return blocks;
}

function renderInline(text: string): React.ReactNode {
  // Split on **bold** spans; everything else is plain text.
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={idx}>{part.slice(2, -2)}</strong>;
    }
    return <Fragment key={idx}>{part}</Fragment>;
  });
}

export function MarkdownView({ source, className = '' }: Props) {
  const blocks = parse(source);
  return (
    <div className={`flex flex-col gap-3 text-sm leading-relaxed ${className}`}>
      {blocks.map((b, idx) => {
        switch (b.kind) {
          case 'h3':
            return (
              <h3 key={idx} className="text-base font-bold mt-2 first:mt-0">
                {renderInline(b.text)}
              </h3>
            );
          case 'h4':
            return (
              <h4 key={idx} className="text-[13px] font-bold uppercase tracking-wider opacity-70 mt-1">
                {renderInline(b.text)}
              </h4>
            );
          case 'list':
            return (
              <ul key={idx} className="flex flex-col gap-1.5 pl-5 list-disc marker:text-accent">
                {b.items.map((item, i) => (
                  <li key={i}>{renderInline(item)}</li>
                ))}
              </ul>
            );
          case 'p':
            return (
              <p key={idx} className="opacity-90">
                {renderInline(b.text)}
              </p>
            );
        }
      })}
    </div>
  );
}
