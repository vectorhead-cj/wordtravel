import { Grid, Cell, RuleTile, SoftForbiddenConstraint, addCellRuleTile, getCellRuleTiles, setCellRuleTiles } from './types';

const COMBINING_CIRCUMFLEX = '\u0302'; // hard match
const COMBINING_TILDE = '\u0303'; // soft match → next row
const COMBINING_SOFT_UP = '\u030b'; // soft match → prev row (double acute)
const COMBINING_DIAERESIS = '\u0308'; // forbidden → next row
const COMBINING_FORBIDDEN_UP = '\u0312'; // forbidden → prev row (turned comma above)

const KNOWN_MARKS = new Set([
  COMBINING_CIRCUMFLEX,
  COMBINING_TILDE,
  COMBINING_SOFT_UP,
  COMBINING_DIAERESIS,
  COMBINING_FORBIDDEN_UP,
]);

const STANDALONE_HARD = '^';
const STANDALONE_SOFT = '~';
const STANDALONE_FORBIDDEN = '¨';

function softForbiddenConstraintEmpty(c: SoftForbiddenConstraint): boolean {
  return c.nextRow === undefined && c.prevRow === undefined;
}

function filterKnownSortedMarks(nfdTail: string): string {
  return [...nfdTail]
    .filter(ch => KNOWN_MARKS.has(ch))
    .sort()
    .join('');
}

function consumeDirectionalRules(
  downCount: number,
  upCount: number,
  type: 'softMatch' | 'forbiddenMatch',
  row: number,
): RuleTile[] {
  const rules: RuleTile[] = [];
  let down = downCount;
  let up = upCount;

  while (down > 0 || up > 0) {
    const constraint: SoftForbiddenConstraint = {};
    if (down > 0) {
      constraint.nextRow = row + 1;
      down--;
    }
    if (up > 0) {
      constraint.prevRow = row - 1;
      up--;
    }
    rules.push({ type, constraint } as RuleTile);
  }

  return rules;
}

function rulesFromCombiningMarks(marks: string, row: number, col: number): RuleTile[] | undefined {
  const counts = new Map<string, number>();
  for (const mark of marks) {
    counts.set(mark, (counts.get(mark) ?? 0) + 1);
  }

  const rules: RuleTile[] = [];
  const hardCount = counts.get(COMBINING_CIRCUMFLEX) ?? 0;
  for (let i = 0; i < hardCount; i++) {
    rules.push({
      type: 'hardMatch',
      constraint: { pairedRow: row + 1, pairedCol: col, position: 'top' },
    });
  }

  rules.push(
    ...consumeDirectionalRules(
      counts.get(COMBINING_TILDE) ?? 0,
      counts.get(COMBINING_SOFT_UP) ?? 0,
      'softMatch',
      row,
    ),
  );
  rules.push(
    ...consumeDirectionalRules(
      counts.get(COMBINING_DIAERESIS) ?? 0,
      counts.get(COMBINING_FORBIDDEN_UP) ?? 0,
      'forbiddenMatch',
      row,
    ),
  );

  if (rules.length === 0 || rules.length > 2) return undefined;
  return rules;
}

function combiningFromRule(tile: RuleTile): string[] {
  if (tile.type === 'hardMatch') {
    return tile.constraint.position === 'bottom' ? [] : [COMBINING_CIRCUMFLEX];
  }
  if (tile.type === 'softMatch') {
    const parts: string[] = [];
    if (tile.constraint.nextRow !== undefined) parts.push(COMBINING_TILDE);
    if (tile.constraint.prevRow !== undefined) parts.push(COMBINING_SOFT_UP);
    return parts;
  }
  const parts: string[] = [];
  if (tile.constraint.nextRow !== undefined) parts.push(COMBINING_DIAERESIS);
  if (tile.constraint.prevRow !== undefined) parts.push(COMBINING_FORBIDDEN_UP);
  return parts;
}

function combiningFromRules(tiles: RuleTile[]): string | null {
  const parts = tiles.flatMap(combiningFromRule).sort();
  if (parts.length === 0) return null;
  return parts.join('');
}

interface ParsedChar {
  base: string;
  combining: string | null;
}

function decomposeChar(raw: string): ParsedChar {
  if (raw === STANDALONE_HARD) return { base: '.', combining: COMBINING_CIRCUMFLEX };
  if (raw === STANDALONE_SOFT) return { base: '.', combining: COMBINING_TILDE };
  if (raw === STANDALONE_FORBIDDEN) return { base: '.', combining: COMBINING_DIAERESIS };
  if (raw === ' ' || raw === '.') return { base: raw, combining: null };

  const nfd = raw.normalize('NFD');
  if (nfd.length === 1) return { base: nfd, combining: null };

  const base = nfd[0];
  const marks = filterKnownSortedMarks(nfd.slice(1));
  if (marks.length === 0) return { base: raw, combining: null };
  return { base, combining: marks };
}

/**
 * Iterates over visual characters in a string, handling combining marks.
 * Returns an array of raw character clusters (base + any combining marks).
 */
function graphemeClusters(line: string): string[] {
  const nfd = line.normalize('NFD');
  const clusters: string[] = [];
  let i = 0;
  while (i < nfd.length) {
    let cluster = nfd[i];
    i++;
    while (i < nfd.length && isCombining(nfd.charCodeAt(i))) {
      cluster += nfd[i];
      i++;
    }
    clusters.push(cluster.normalize('NFC'));
  }
  return clusters;
}

function isCombining(code: number): boolean {
  return code >= 0x0300 && code <= 0x036f;
}

export interface ParseGridOptions {
  /**
   * When true, `a`–`z` are player-filled (non-fixed); `A`–`Z` stay givens. Matches {@link serializeGridDebug}.
   */
  lowercaseLettersAsPlayerFill?: boolean;
}

export function parseGrid(notation: string, options?: ParseGridOptions): Grid {
  const debugCase = options?.lowercaseLettersAsPlayerFill === true;
  const lines = notation.split('\n');
  const charGrid = lines.map(line => graphemeClusters(line));
  const cols = Math.max(...charGrid.map(row => row.length));
  const rows = charGrid.length;

  const cells: Cell[][] = [];

  for (let r = 0; r < rows; r++) {
    cells[r] = [];
    for (let c = 0; c < cols; c++) {
      const raw = charGrid[r][c] ?? ' ';
      const { base, combining } = decomposeChar(raw);

      if (base === ' ') {
        cells[r][c] = { letter: null, state: 'empty', accessible: false, validation: 'none' };
        continue;
      }

      const isLetter = /^[A-Z]$/i.test(base);
      const ruleTiles = combining ? rulesFromCombiningMarks(combining, r, c) : undefined;

      if (isLetter) {
        const upper = base.toUpperCase();
        const isPlayerFill = debugCase && /^[a-z]$/.test(base);
        cells[r][c] = isPlayerFill
          ? {
              letter: upper,
              state: 'filled',
              accessible: true,
              validation: 'none',
              fixed: false,
              ruleTile: ruleTiles?.[0],
              ruleTiles,
            }
          : {
              letter: upper,
              state: 'locked',
              accessible: true,
              validation: 'correct',
              fixed: true,
              ruleTile: ruleTiles?.[0],
              ruleTiles,
            };
      } else {
        cells[r][c] = {
          letter: null,
          state: 'empty',
          accessible: true,
          validation: 'none',
          ruleTile: ruleTiles?.[0],
          ruleTiles,
        };
      }
    }
  }

  // Auto-create hard match bottom partners
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = cells[r][c];
      for (const rule of getCellRuleTiles(cell)) {
        if (rule.type === 'hardMatch' && rule.constraint.position === 'top') {
          const targetRow = rule.constraint.pairedRow;
          const targetCol = rule.constraint.pairedCol;
          if (targetRow < rows && targetCol < cols) {
            const target = cells[targetRow][targetCol];
            const hasBottom = getCellRuleTiles(target).some(
              t =>
                t.type === 'hardMatch' &&
                t.constraint.position === 'bottom' &&
                t.constraint.pairedRow === r &&
                t.constraint.pairedCol === c,
            );
            if (!hasBottom) {
              addCellRuleTile(target, {
                type: 'hardMatch',
                constraint: { pairedRow: r, pairedCol: c, position: 'bottom' },
              });
            }
          }
        }
      }
    }
  }

  return { rows, cols, cells };
}

export function serializeGrid(grid: Grid): string {
  const lines: string[] = [];

  for (let r = 0; r < grid.rows; r++) {
    let line = '';
    for (let c = 0; c < grid.cols; c++) {
      const cell = grid.cells[r][c];

      if (!cell.accessible) {
        line += ' ';
        continue;
      }

      const combining = combiningFromRules(getCellRuleTiles(cell));
      const hasLetter = cell.fixed && cell.letter;

      if (hasLetter && combining) {
        line += (cell.letter!.toUpperCase() + combining).normalize('NFC');
      } else if (hasLetter) {
        line += cell.letter!.toUpperCase();
      } else if (combining) {
        if (combining === COMBINING_CIRCUMFLEX) line += STANDALONE_HARD;
        else if (combining === COMBINING_TILDE) line += STANDALONE_SOFT;
        else if (combining === COMBINING_DIAERESIS) line += STANDALONE_FORBIDDEN;
        else line += ('.' + combining).normalize('NFC');
      } else {
        line += '.';
      }
    }

    lines.push(line);
  }

  return lines.join('\n');
}

/**
 * Like {@link serializeGrid} but includes any cell letter. Fixed givens stay uppercase; player-filled
 * letters (non-fixed) use lowercase. Rule tiles and spacing match {@link serializeGrid}.
 */
export function serializeGridDebug(grid: Grid): string {
  const lines: string[] = [];

  for (let r = 0; r < grid.rows; r++) {
    let line = '';
    for (let c = 0; c < grid.cols; c++) {
      const cell = grid.cells[r][c];

      if (!cell.accessible) {
        line += ' ';
        continue;
      }

      const combining = combiningFromRules(getCellRuleTiles(cell));
      const hasLetter = Boolean(cell.letter);
      const letterGlyph = hasLetter
        ? cell.fixed
          ? cell.letter!.toUpperCase()
          : cell.letter!.toLowerCase()
        : '';

      if (hasLetter && combining) {
        line += (letterGlyph + combining).normalize('NFC');
      } else if (hasLetter) {
        line += letterGlyph;
      } else if (combining) {
        if (combining === COMBINING_CIRCUMFLEX) line += STANDALONE_HARD;
        else if (combining === COMBINING_TILDE) line += STANDALONE_SOFT;
        else if (combining === COMBINING_DIAERESIS) line += STANDALONE_FORBIDDEN;
        else line += ('.' + combining).normalize('NFC');
      } else {
        line += '.';
      }
    }

    lines.push(line);
  }

  return lines.join('\n');
}

function shiftSoftForbidden(
  c: SoftForbiddenConstraint,
  rowOffset: number,
): SoftForbiddenConstraint {
  const next: SoftForbiddenConstraint = {};
  if (c.nextRow !== undefined) next.nextRow = c.nextRow + rowOffset;
  if (c.prevRow !== undefined) next.prevRow = c.prevRow + rowOffset;
  return next;
}

function shiftRuleTile(tile: RuleTile, rowOffset: number): RuleTile {
  if (tile.type === 'hardMatch') {
    return {
      ...tile,
      constraint: {
        ...tile.constraint,
        pairedRow: tile.constraint.pairedRow + rowOffset,
      },
    };
  }
  if (tile.type === 'softMatch') {
    return {
      ...tile,
      constraint: shiftSoftForbidden(tile.constraint, rowOffset),
    };
  }
  return {
    ...tile,
    constraint: shiftSoftForbidden(tile.constraint, rowOffset),
  } as RuleTile;
}

export function addPadding(grid: Grid, top: number, bottom: number): Grid {
  const cols = grid.cols;
  const newRows = grid.rows + top + bottom;

  const makeEmptyRow = (): Cell[] =>
    Array.from({ length: cols }, () => ({
      letter: null,
      state: 'empty' as const,
      accessible: false,
      validation: 'none' as const,
    }));

  const topRows = Array.from({ length: top }, makeEmptyRow);
  const bottomRows = Array.from({ length: bottom }, makeEmptyRow);

  // Shift rule tile references in existing cells
  const shiftedCells = grid.cells.map(row =>
    row.map(cell => {
      if (!cell.ruleTiles || cell.ruleTiles.length === 0) return { ...cell };
      const shiftedRules = cell.ruleTiles.map(tile => shiftRuleTile(tile, top));
      return { ...cell, ruleTile: shiftedRules[0], ruleTiles: shiftedRules };
    })
  );

  return {
    rows: newRows,
    cols,
    cells: [...topRows, ...shiftedCells, ...bottomRows],
  };
}
