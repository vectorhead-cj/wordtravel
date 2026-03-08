import { Grid, Cell, RuleTile } from './types';

const COMBINING_CIRCUMFLEX = '\u0302'; // hard match
const COMBINING_TILDE = '\u0303';      // soft match
const COMBINING_DIAERESIS = '\u0308';  // forbidden match

const STANDALONE_HARD = '^';
const STANDALONE_SOFT = '~';
const STANDALONE_FORBIDDEN = '¨';

function ruleFromCombining(mark: string, row: number, col: number): RuleTile | undefined {
  switch (mark) {
    case COMBINING_CIRCUMFLEX:
      return {
        type: 'hardMatch',
        constraint: { pairedRow: row + 1, pairedCol: col, position: 'top' },
      };
    case COMBINING_TILDE:
      return {
        type: 'softMatch',
        constraint: { nextRow: row + 1 },
      };
    case COMBINING_DIAERESIS:
      return {
        type: 'forbiddenMatch',
        constraint: { nextRow: row + 1 },
      };
    default:
      return undefined;
  }
}

function combiningFromRule(tile: RuleTile): string | null {
  if (tile.type === 'hardMatch' && tile.constraint.position === 'bottom') return null;
  if (tile.type === 'hardMatch') return COMBINING_CIRCUMFLEX;
  if (tile.type === 'softMatch') return COMBINING_TILDE;
  if (tile.type === 'forbiddenMatch') return COMBINING_DIAERESIS;
  return null;
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
  const mark = nfd.slice(1);
  if (mark === COMBINING_CIRCUMFLEX || mark === COMBINING_TILDE || mark === COMBINING_DIAERESIS) {
    return { base, combining: mark };
  }
  return { base: raw, combining: null };
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

export function parseGrid(notation: string): Grid {
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
      const rule = combining ? ruleFromCombining(combining, r, c) : undefined;

      if (isLetter) {
        cells[r][c] = {
          letter: base.toUpperCase(),
          state: 'locked',
          accessible: true,
          validation: 'correct',
          fixed: true,
          ruleTile: rule,
        };
      } else {
        cells[r][c] = {
          letter: null,
          state: 'empty',
          accessible: true,
          validation: 'none',
          ruleTile: rule,
        };
      }
    }
  }

  // Auto-create hard match bottom partners
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = cells[r][c];
      if (cell.ruleTile?.type === 'hardMatch' && cell.ruleTile.constraint.position === 'top') {
        const targetRow = cell.ruleTile.constraint.pairedRow;
        const targetCol = cell.ruleTile.constraint.pairedCol;
        if (targetRow < rows && targetCol < cols) {
          const target = cells[targetRow][targetCol];
          if (!target.ruleTile) {
            target.ruleTile = {
              type: 'hardMatch',
              constraint: { pairedRow: r, pairedCol: c, position: 'bottom' },
            };
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

      const rule = cell.ruleTile;
      const combining = rule ? combiningFromRule(rule) : null;
      const hasLetter = cell.fixed && cell.letter;

      if (hasLetter && combining) {
        line += (cell.letter!.toUpperCase() + combining).normalize('NFC');
      } else if (hasLetter) {
        line += cell.letter!.toUpperCase();
      } else if (combining) {
        // Empty cell with rule -> standalone char
        if (combining === COMBINING_CIRCUMFLEX) line += STANDALONE_HARD;
        else if (combining === COMBINING_TILDE) line += STANDALONE_SOFT;
        else if (combining === COMBINING_DIAERESIS) line += STANDALONE_FORBIDDEN;
        else line += '.';
      } else {
        line += '.';
      }
    }

    lines.push(line);
  }

  return lines.join('\n');
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
      constraint: { nextRow: tile.constraint.nextRow + rowOffset },
    };
  }
  return {
    ...tile,
    constraint: { nextRow: (tile as any).constraint.nextRow + rowOffset },
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
      if (!cell.ruleTile) return { ...cell };
      return { ...cell, ruleTile: shiftRuleTile(cell.ruleTile, top) };
    })
  );

  return {
    rows: newRows,
    cols,
    cells: [...topRows, ...shiftedCells, ...bottomRows],
  };
}
