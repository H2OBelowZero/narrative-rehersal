// Standard screenplay page geometry and pagination. Pure: used by the app to lay out the page and by tests.
// US Letter (8.5" x 11"), 12-point Courier: 10 characters to the inch, 6 lines to the inch.
// Margins: left 1.5" (binding), right/top/bottom 1". The body is 6" wide (60 columns) and 9" tall (54 lines).
import type { ScriptElement, ScriptElementType } from './types.ts';

export const PAGE = { width: 8.5, height: 11, left: 1.5, right: 1, top: 1, bottom: 1, numberTop: 0.5 } as const;
export const BODY_WIDTH = PAGE.width - PAGE.left - PAGE.right; // 6"
export const LINES_PER_PAGE = (PAGE.height - PAGE.top - PAGE.bottom) * 6; // 54
const CPI = 10;

/** Where each element sits, in inches from the page's left edge. */
export const COLUMN: Record<ScriptElementType, { left: number; right: number; align?: 'right' }> = {
  heading: { left: 1.5, right: 7.5 },
  action: { left: 1.5, right: 7.5 },
  shot: { left: 1.5, right: 7.5 },
  character: { left: 3.7, right: 7.5 },
  parenthetical: { left: 3.1, right: 5.6 },
  dialogue: { left: 2.5, right: 6.5 },
  transition: { left: 5.5, right: 7.5, align: 'right' },
};

/** Blank lines above each element (none at the top of a page). */
export const BLANK_BEFORE: Record<ScriptElementType, number> = {
  heading: 1,
  action: 1,
  shot: 1,
  character: 1,
  parenthetical: 0,
  dialogue: 0,
  transition: 1,
};

/** Elements that must not be left alone at the foot of a page. */
const KEEP_WITH_NEXT = new Set<ScriptElementType>(['heading', 'shot', 'character', 'parenthetical']);

export const columns = (type: ScriptElementType) => Math.round((COLUMN[type].right - COLUMN[type].left) * CPI);

/** Offset and width as fractions of the 6" body, so the same layout scales to any page width. */
export function placement(type: ScriptElementType): { left: number; width: number } {
  const c = COLUMN[type];
  return { left: (c.left - PAGE.left) / BODY_WIDTH, width: (c.right - c.left) / BODY_WIDTH };
}

/** Text as typed on the page: parentheticals wear their parentheses. */
export function printed(el: Pick<ScriptElement, 'type' | 'text'>): string {
  const t = el.text.trim();
  if (el.type !== 'parenthetical' || !t) return el.text;
  return `${t.startsWith('(') ? '' : '('}${t}${t.endsWith(')') ? '' : ')'}`;
}

/**
 * Lines `text` takes when word-wrapped at `cols` monospaced columns (at least one). Breaks at spaces and, as browsers
 * and typewriter convention do, after a hyphen; a word longer than the line is broken across lines.
 */
export function wrappedLines(text: string, cols: number): number {
  let lines = 0;
  for (const paragraph of text.split('\n')) {
    let line = 0;
    lines += 1;
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      word.split(/(?<=-)(?=.)/).forEach((piece, i) => {
        const gap = i === 0 && line > 0 ? 1 : 0;
        let w = piece.length;
        if (line > 0 && line + gap + w <= cols) {
          line += gap + w;
          return;
        }
        if (line > 0) lines += 1;
        while (w > cols) {
          lines += 1;
          w -= cols;
        }
        line = w;
      });
    }
  }
  return Math.max(1, lines);
}

export interface Placed {
  /** 1-based page this element starts on. */
  page: number;
  /** Blank lines drawn above it (0 at the top of a page). */
  blank: number;
  lines: number;
}

export interface Pagination {
  placed: Map<string, Placed>;
  /** Lines used on each page, so the page can be filled to its full height. */
  used: number[];
  pages: number;
}

/** Breaks a script into 54-line pages; headings, cues and parentheticals stay with the line that follows them. */
export function paginate(elements: Pick<ScriptElement, 'id' | 'type' | 'text'>[]): Pagination {
  const placed = new Map<string, Placed>();
  const used: number[] = [0];
  const size = elements.map((e) => wrappedLines(printed(e), columns(e.type)));
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i]!;
    let page = used.length - 1;
    let blank = used[page]! === 0 ? 0 : BLANK_BEFORE[el.type];
    let need = blank + size[i]!;
    const next = elements[i + 1];
    // Elements move whole (never split), so the line that follows must fit entirely.
    if (next && KEEP_WITH_NEXT.has(el.type)) need += BLANK_BEFORE[next.type] + size[i + 1]!;
    if (used[page]! > 0 && used[page]! + need > LINES_PER_PAGE) {
      used.push(0);
      page += 1;
      blank = 0;
    }
    used[page] = used[page]! + blank + size[i]!;
    placed.set(el.id, { page: page + 1, blank, lines: size[i]! });
  }
  return { placed, used, pages: used.length };
}
