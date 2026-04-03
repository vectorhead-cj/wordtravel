import { PuzzleGenerator } from './PuzzleGenerator';
import { parseGrid, serializeGrid } from './PuzzleNotation';
import { generatorDictionary } from './Dictionary';
import { GENERATION_PROFILES, PUZZLE_CONFIG } from './config';
import {
  Grid,
  PuzzleType,
  Difficulty,
  getCellRuleTiles,
  softForbiddenTargetRows,
} from './types';
import {
  validateHardMatchTiles,
  validateSoftMatchTiles,
  validateForbiddenMatchTiles,
  validateNoHardMatchForbiddenConflict,
  isRowComplete,
} from './GameLogic';

const FUZZ_ITERATIONS = 2000;
const gen = new PuzzleGenerator();

beforeAll(() => {
  generatorDictionary.initialize();
});

/** Fast grid generation — runs staged pipeline without difficulty simulation. */
function generateGridFast(puzzleType: PuzzleType, difficulty: Difficulty = 'medium'): Grid {
  return gen.generateGrid(puzzleType, difficulty);
}

function findWordRows(grid: Grid): number[] {
  const rows: number[] = [];
  for (let r = 0; r < grid.rows; r++) {
    if (grid.cells[r].some(c => c.accessible)) rows.push(r);
  }
  return rows;
}

function getAccessibleCells(grid: Grid, row: number) {
  return grid.cells[row].filter(c => c.accessible);
}

function getWordFromRow(grid: Grid, row: number): string {
  return grid.cells[row]
    .filter(c => c.accessible && c.letter)
    .map(c => c.letter!)
    .join('');
}

// =============================================================================
// Integration: generatePuzzle (with simulation — just a few calls)
// =============================================================================

describe('generatePuzzle integration', () => {
  it.each(['open', 'bridge', 'semi'] as const)(
    'produces a parseable puzzle string with difficulty metadata for %s mode',
    (puzzleType) => {
      const { puzzle, difficulty, successRate } = gen.generatePuzzle(puzzleType);
      const grid = parseGrid(puzzle);
      expect(grid.rows).toBeGreaterThan(0);
      expect(grid.cols).toBeGreaterThan(0);
      expect(['easy', 'medium', 'hard']).toContain(difficulty);
      expect(successRate).toBeGreaterThanOrEqual(0);
      expect(successRate).toBeLessThanOrEqual(1);
    },
  );
});

// =============================================================================
// Puzzle type shapes
// =============================================================================

describe('bridge mode', () => {
  it('has first and last word rows fully fixed with valid dictionary words', () => {
    const grid = generateGridFast('bridge');
    const wordRows = findWordRows(grid);
    const firstRow = wordRows[0];
    const lastRow = wordRows[wordRows.length - 1];

    for (const row of [firstRow, lastRow]) {
      for (let c = 0; c < grid.cols; c++) {
        if (grid.cells[row][c].accessible) {
          expect(grid.cells[row][c].fixed).toBe(true);
          expect(grid.cells[row][c].letter).toBeTruthy();
        }
      }
    }

    expect(generatorDictionary.isValidWord(getWordFromRow(grid, firstRow))).toBe(true);
    expect(generatorDictionary.isValidWord(getWordFromRow(grid, lastRow))).toBe(true);
  });
});

describe('semi mode', () => {
  it('has only last word row fully fixed', () => {
    const grid = generateGridFast('semi');
    const wordRows = findWordRows(grid);

    expect(getAccessibleCells(grid, wordRows[0]).every(c => c.fixed)).toBe(false);
    for (let c = 0; c < grid.cols; c++) {
      if (grid.cells[wordRows[wordRows.length - 1]][c].accessible) {
        expect(grid.cells[wordRows[wordRows.length - 1]][c].fixed).toBe(true);
      }
    }
  });
});

describe('open mode', () => {
  it('has no fully-fixed word rows', () => {
    const grid = generateGridFast('open');
    for (const row of findWordRows(grid)) {
      expect(getAccessibleCells(grid, row).every(c => c.fixed)).toBe(false);
    }
  });
});

// =============================================================================
// Property fuzz tests — catch interaction bugs across stages
// =============================================================================

describe('property fuzz tests', () => {
  for (const puzzleType of ['open', 'bridge', 'semi'] as PuzzleType[]) {
    describe(`${puzzleType} mode (${FUZZ_ITERATIONS}×)`, () => {
      it('never has hard match pairs with mismatched fixed letters', () => {
        for (let i = 0; i < FUZZ_ITERATIONS; i++) {
          const grid = generateGridFast(puzzleType);
          for (let r = 0; r < grid.rows; r++) {
            for (let c = 0; c < grid.cols; c++) {
              const cell = grid.cells[r][c];
              for (const rule of getCellRuleTiles(cell)) {
                if (rule.type !== 'hardMatch' || rule.constraint.position !== 'top') continue;
                const paired = grid.cells[rule.constraint.pairedRow]?.[rule.constraint.pairedCol];
                if (cell.fixed && paired?.fixed) {
                  expect(cell.letter).toBe(paired.letter);
                }
              }
            }
          }
        }
      });

      it('passes validateNoHardMatchForbiddenConflict for completed rows', () => {
        for (let i = 0; i < FUZZ_ITERATIONS; i++) {
          const grid = generateGridFast(puzzleType);
          for (let r = 0; r < grid.rows; r++) {
            if (!isRowComplete(grid, r)) continue;
            expect(validateNoHardMatchForbiddenConflict(grid, r)).toBe(true);
          }
        }
      });

      it('has valid hard match pairs on completed rows', () => {
        for (let i = 0; i < FUZZ_ITERATIONS; i++) {
          const grid = generateGridFast(puzzleType);
          for (let r = 0; r < grid.rows; r++) {
            if (!isRowComplete(grid, r)) continue;
            expect(validateHardMatchTiles(grid, r)).toBe(true);
          }
        }
      });

      it('has valid soft match on completed rows', () => {
        for (let i = 0; i < FUZZ_ITERATIONS; i++) {
          const grid = generateGridFast(puzzleType);
          for (let r = 0; r < grid.rows; r++) {
            if (!isRowComplete(grid, r)) continue;
            expect(validateSoftMatchTiles(grid, r)).toBe(true);
          }
        }
      });

      it('has valid forbidden match on completed rows', () => {
        for (let i = 0; i < FUZZ_ITERATIONS; i++) {
          const grid = generateGridFast(puzzleType);
          for (let r = 0; r < grid.rows; r++) {
            if (!isRowComplete(grid, r)) continue;
            expect(validateForbiddenMatchTiles(grid, r)).toBe(true);
          }
        }
      });

      it('never has a fixed soft match trivially satisfied in target row', () => {
        for (let i = 0; i < FUZZ_ITERATIONS; i++) {
          const grid = generateGridFast(puzzleType);
          for (let r = 0; r < grid.rows; r++) {
            for (let c = 0; c < grid.cols; c++) {
              const cell = grid.cells[r][c];
              for (const rule of getCellRuleTiles(cell)) {
                if (rule.type !== 'softMatch' || !cell.fixed || !cell.letter) continue;
                for (const targetRow of softForbiddenTargetRows(rule.constraint)) {
                  const hasTrivialMatch = grid.cells[targetRow].some(
                    tc => tc.accessible && tc.fixed && tc.letter === cell.letter,
                  );
                  expect(hasTrivialMatch).toBe(false);
                }
              }
            }
          }
        }
      });

      it('round-trips through serialize/parse', () => {
        for (let i = 0; i < FUZZ_ITERATIONS; i++) {
          const grid = generateGridFast(puzzleType);
          const serialized = serializeGrid(grid);
          const roundTripped = serializeGrid(parseGrid(serialized));
          expect(roundTripped).toBe(serialized);
        }
      });
    });
  }
});

// =============================================================================
// Direction gating
// =============================================================================

describe('soft/forbidden direction gating', () => {
  it('easy and medium never set prevRow on soft or forbidden tiles', () => {
    for (const difficulty of ['easy', 'medium'] as const) {
      for (let i = 0; i < FUZZ_ITERATIONS; i++) {
        const grid = generateGridFast('open', difficulty);
        for (let r = 0; r < grid.rows; r++) {
          for (let c = 0; c < grid.cols; c++) {
            for (const rule of getCellRuleTiles(grid.cells[r][c])) {
              if (rule.type === 'softMatch' || rule.type === 'forbiddenMatch') {
                expect(rule.constraint.prevRow).toBeUndefined();
              }
            }
          }
        }
      }
    }
  });

  it('last word row never has nextRow soft/forbidden tiles', () => {
    for (let i = 0; i < FUZZ_ITERATIONS; i++) {
      const grid = generateGridFast('open');
      const wordRows = findWordRows(grid);
      const lastRow = wordRows[wordRows.length - 1];

      for (let c = 0; c < grid.cols; c++) {
        for (const rule of getCellRuleTiles(grid.cells[lastRow][c])) {
          if (rule.type === 'softMatch' || rule.type === 'forbiddenMatch') {
            expect(rule.constraint.nextRow).toBeUndefined();
          }
        }
      }
    }
  });

  it('hard mode sometimes sets prevRow on soft or forbidden', () => {
    let sawPrev = false;
    for (let i = 0; i < 50 && !sawPrev; i++) {
      const grid = generateGridFast('open', 'hard');
      for (let r = 0; r < grid.rows && !sawPrev; r++) {
        for (let c = 0; c < grid.cols && !sawPrev; c++) {
          for (const rule of getCellRuleTiles(grid.cells[r][c])) {
            if ((rule.type === 'softMatch' || rule.type === 'forbiddenMatch') &&
                rule.constraint.prevRow !== undefined) {
              sawPrev = true;
            }
          }
        }
      }
    }
    expect(sawPrev).toBe(true);
  });
});

// =============================================================================
// Rule tile limits
// =============================================================================

describe('rule tile limits', () => {
  it('hard mode keeps at most two rules per cell', () => {
    for (let i = 0; i < FUZZ_ITERATIONS; i++) {
      const grid = generateGridFast('open', 'hard');
      for (let r = 0; r < grid.rows; r++) {
        for (let c = 0; c < grid.cols; c++) {
          expect(getCellRuleTiles(grid.cells[r][c]).length).toBeLessThanOrEqual(2);
        }
      }
    }
  });

  it('no cell has two rules using the same visual half', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      for (let i = 0; i < FUZZ_ITERATIONS; i++) {
        const grid = generateGridFast('open', difficulty);
        for (let r = 0; r < grid.rows; r++) {
          for (let c = 0; c < grid.cols; c++) {
            const rules = getCellRuleTiles(grid.cells[r][c]);
            let topCount = 0;
            let bottomCount = 0;
            for (const rule of rules) {
              if (rule.type === 'hardMatch') {
                if (rule.constraint.position === 'top') bottomCount++;    // points down → bottom half
                if (rule.constraint.position === 'bottom') topCount++;    // points up → top half
              } else {
                if (rule.constraint.nextRow !== undefined) bottomCount++; // points down → bottom half
                if (rule.constraint.prevRow !== undefined) topCount++;    // points up → top half
              }
            }
            expect(topCount).toBeLessThanOrEqual(1);
            expect(bottomCount).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });

  it('hard mode combined directional rules are bidirectional', () => {
    for (let i = 0; i < FUZZ_ITERATIONS; i++) {
      const grid = generateGridFast('open', 'hard');
      for (let r = 0; r < grid.rows; r++) {
        for (let c = 0; c < grid.cols; c++) {
          const rules = getCellRuleTiles(grid.cells[r][c]);
          if (rules.length < 2) continue;
          for (const rule of rules) {
            if (rule.type === 'softMatch' || rule.type === 'forbiddenMatch') {
              if (rule.constraint.nextRow !== undefined || rule.constraint.prevRow !== undefined) {
                expect(rule.constraint.nextRow).toBeDefined();
                expect(rule.constraint.prevRow).toBeDefined();
              }
            }
          }
        }
      }
    }
  });
});

// =============================================================================
// Hard-match chains
// =============================================================================

describe('hard-match chains', () => {
  it('hard mode sometimes produces chains of length 3', () => {
    let sawChain = false;
    for (let i = 0; i < 50 && !sawChain; i++) {
      const grid = generateGridFast('open', 'hard');
      for (let r = 0; r < grid.rows && !sawChain; r++) {
        for (let c = 0; c < grid.cols && !sawChain; c++) {
          const rules = getCellRuleTiles(grid.cells[r][c]);
          const hasTop = rules.some(r => r.type === 'hardMatch' && r.constraint.position === 'top');
          const hasBottom = rules.some(r => r.type === 'hardMatch' && r.constraint.position === 'bottom');
          if (hasTop && hasBottom) sawChain = true;
        }
      }
    }
    expect(sawChain).toBe(true);
  });

  it('middle chain cells have one top and one bottom hard-match pointing to different rows', () => {
    let sawMiddle = false;
    for (let i = 0; i < FUZZ_ITERATIONS; i++) {
      const grid = generateGridFast('open', 'hard');
      for (let r = 0; r < grid.rows; r++) {
        for (let c = 0; c < grid.cols; c++) {
          const rules = getCellRuleTiles(grid.cells[r][c]);
          const hardRules = rules.filter(rule => rule.type === 'hardMatch');
          const tops = hardRules.filter(h => h.constraint.position === 'top');
          const bottoms = hardRules.filter(h => h.constraint.position === 'bottom');

          if (tops.length === 1 && bottoms.length === 1) {
            sawMiddle = true;
            expect(tops[0].constraint.pairedRow).not.toBe(bottoms[0].constraint.pairedRow);
          }
        }
      }
    }
    expect(sawMiddle).toBe(true);
  });

  it('chain round-trips through serialize/parse', () => {
    for (let i = 0; i < FUZZ_ITERATIONS; i++) {
      const grid = generateGridFast('open', 'hard');
      const serialized = serializeGrid(grid);
      const parsed = parseGrid(serialized);
      const reserialized = serializeGrid(parsed);
      expect(reserialized).toBe(serialized);
    }
  });
});

// =============================================================================
// Word length sequence constraints
// =============================================================================

describe('word length sequence constraints', () => {
  it('never produces more than maxConsecutiveSameLength consecutive same-length words', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      const profile = GENERATION_PROFILES[difficulty];
      for (let i = 0; i < FUZZ_ITERATIONS; i++) {
        const grid = generateGridFast('open', difficulty);
        const wordRows = findWordRows(grid);
        const lengths = wordRows.map(r => getAccessibleCells(grid, r).length);

        let streak = 1;
        for (let j = 1; j < lengths.length; j++) {
          if (lengths[j] === lengths[j - 1]) {
            streak++;
            expect(streak).toBeLessThanOrEqual(profile.maxConsecutiveSameLength);
          } else {
            streak = 1;
          }
        }
      }
    }
  });
});

// =============================================================================
// Forbidden grouping
// =============================================================================

describe('forbidden grouping', () => {
  it('rows with only forbidden tiles have at least minForbiddenGroupSize forbidden tiles', () => {
    for (let i = 0; i < FUZZ_ITERATIONS; i++) {
      const grid = generateGridFast('open');
      const wordRows = findWordRows(grid);

      for (const row of wordRows) {
        let forbiddenCount = 0;
        let hasOtherRule = false;

        for (let c = 0; c < grid.cols; c++) {
          for (const rule of getCellRuleTiles(grid.cells[row][c])) {
            if (rule.type === 'forbiddenMatch') {
              forbiddenCount++;
            } else {
              hasOtherRule = true;
            }
          }
        }

        if (forbiddenCount > 0 && !hasOtherRule) {
          expect(forbiddenCount).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });
});

// =============================================================================
// Min modifiers per row
// =============================================================================

describe('min modifiers per row', () => {
  it.each(['easy', 'medium', 'hard'] as const)(
    '%s: every row has at least minModifiersPerRow modifiers',
    (difficulty) => {
      const profile = GENERATION_PROFILES[difficulty];
      for (let i = 0; i < FUZZ_ITERATIONS; i++) {
        const grid = generateGridFast('open', difficulty);
        const wordRows = findWordRows(grid);

        for (const row of wordRows) {
          // Fully-fixed rows (fixed words) are exempt
          if (getAccessibleCells(grid, row).every(c => c.fixed)) continue;

          let count = 0;
          for (let c = 0; c < grid.cols; c++) {
            const rules = getCellRuleTiles(grid.cells[row][c]);
            if (rules.some(r => r.type === 'hardMatch')) {
              count++;
              continue;
            }
            if (rules.some(r => r.type === 'softMatch' || r.type === 'forbiddenMatch')) {
              count++;
            }
          }
          expect(count).toBeGreaterThanOrEqual(profile.minModifiersPerRow);
        }
      }
    },
  );
});

// =============================================================================
// Word length constraints
// =============================================================================

describe('word lengths', () => {
  it('all word lengths are 3, 4, or 5', () => {
    for (let i = 0; i < FUZZ_ITERATIONS; i++) {
      const grid = generateGridFast('open');
      for (const row of findWordRows(grid)) {
        const length = getAccessibleCells(grid, row).length;
        expect([3, 4, 5]).toContain(length);
      }
    }
  });
});

// =============================================================================
// Adjacent word column overlap
// =============================================================================

describe('adjacent word column overlap', () => {
  it('every pair of adjacent word rows shares at least one column', () => {
    for (let i = 0; i < FUZZ_ITERATIONS; i++) {
      const grid = generateGridFast('open');
      const wordRows = findWordRows(grid);

      for (let j = 1; j < wordRows.length; j++) {
        const prevCols = new Set<number>();
        for (let c = 0; c < grid.cols; c++) {
          if (grid.cells[wordRows[j - 1]][c].accessible) prevCols.add(c);
        }
        let overlap = false;
        for (let c = 0; c < grid.cols; c++) {
          if (grid.cells[wordRows[j]][c].accessible && prevCols.has(c)) {
            overlap = true;
            break;
          }
        }
        expect(overlap).toBe(true);
      }
    }
  });
});

// =============================================================================
// First/last row direction constraints
// =============================================================================

describe('first/last row direction constraints', () => {
  it('first word row never has upward-facing modifiers', () => {
    for (let i = 0; i < FUZZ_ITERATIONS; i++) {
      const grid = generateGridFast('open');
      const firstRow = findWordRows(grid)[0];

      for (let c = 0; c < grid.cols; c++) {
        for (const rule of getCellRuleTiles(grid.cells[firstRow][c])) {
          if (rule.type === 'hardMatch') {
            // bottom position = pointing up
            expect(rule.constraint.position).not.toBe('bottom');
          } else {
            expect(rule.constraint.prevRow).toBeUndefined();
          }
        }
      }
    }
  });
});

// =============================================================================
// Fixed tile constraints
// =============================================================================

describe('fixed tile constraints', () => {
  it.each(['easy', 'medium', 'hard'] as const)(
    '%s: fixed tile count (excluding fixed words) does not exceed profile.fixedTiles',
    (difficulty) => {
      const profile = GENERATION_PROFILES[difficulty];
      for (let i = 0; i < FUZZ_ITERATIONS; i++) {
        const grid = generateGridFast('open', difficulty);
        const wordRows = findWordRows(grid);

        // In open mode, no fully-fixed word rows, so all fixed cells are fixed tiles
        let fixedCount = 0;
        for (const row of wordRows) {
          for (let c = 0; c < grid.cols; c++) {
            const cell = grid.cells[row][c];
            if (cell.accessible && cell.fixed) fixedCount++;
          }
        }
        expect(fixedCount).toBeLessThanOrEqual(profile.fixedTiles);
      }
    },
  );

  it('at most one fixed letter tile per row (open mode)', () => {
    for (let i = 0; i < FUZZ_ITERATIONS; i++) {
      const grid = generateGridFast('open');
      for (const row of findWordRows(grid)) {
        let fixedInRow = 0;
        for (let c = 0; c < grid.cols; c++) {
          if (grid.cells[row][c].accessible && grid.cells[row][c].fixed) fixedInRow++;
        }
        expect(fixedInRow).toBeLessThanOrEqual(1);
      }
    }
  });

  it('no fixed tile has a hard-match modifier', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      for (let i = 0; i < FUZZ_ITERATIONS; i++) {
        const grid = generateGridFast('open', difficulty);
        for (let r = 0; r < grid.rows; r++) {
          for (let c = 0; c < grid.cols; c++) {
            const cell = grid.cells[r][c];
            if (!cell.fixed) continue;
            for (const rule of getCellRuleTiles(cell)) {
              expect(rule.type).not.toBe('hardMatch');
            }
          }
        }
      }
    }
  });

  it('fixed letter alphabet uses only common letters', () => {
    const excluded = new Set(PUZZLE_CONFIG.FIXED_LETTER_ALPHABET_EXCLUDE.split(''));
    const allowed = new Set('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter(ch => !excluded.has(ch)));
    for (let i = 0; i < FUZZ_ITERATIONS; i++) {
      const grid = generateGridFast('open');
      for (const row of findWordRows(grid)) {
        const allFixed = getAccessibleCells(grid, row).every(c => c.fixed);
        if (allFixed) continue; // skip fixed words
        for (let c = 0; c < grid.cols; c++) {
          const cell = grid.cells[row][c];
          if (cell.accessible && cell.fixed && cell.letter) {
            expect(allowed.has(cell.letter)).toBe(true);
          }
        }
      }
    }
  });
});

// =============================================================================
// fixedWordRowsMayHaveNonHardModifiers
// =============================================================================

describe('fixedWordRowsMayHaveNonHardModifiers', () => {
  it('easy/medium: fully-fixed rows have no soft or forbidden modifiers', () => {
    for (const difficulty of ['easy', 'medium'] as const) {
      for (let i = 0; i < FUZZ_ITERATIONS; i++) {
        const grid = generateGridFast('bridge', difficulty);
        for (const row of findWordRows(grid)) {
          const cells = getAccessibleCells(grid, row);
          const allFixed = cells.every(c => c.fixed);
          if (!allFixed) continue;
          for (const cell of cells) {
            for (const rule of getCellRuleTiles(cell)) {
              expect(rule.type).not.toBe('softMatch');
              expect(rule.type).not.toBe('forbiddenMatch');
            }
          }
        }
      }
    }
  });
});

// =============================================================================
// Adjacent row connectivity
// =============================================================================

describe('adjacent row connectivity', () => {
  it.each(['easy', 'medium', 'hard'] as const)(
    '%s: every adjacent-row boundary has at least one constraint crossing it',
    (difficulty) => {
      for (let i = 0; i < FUZZ_ITERATIONS; i++) {
        const grid = generateGridFast('open', difficulty);
        const wordRows = findWordRows(grid);

        for (let j = 1; j < wordRows.length; j++) {
          const rowA = wordRows[j - 1];
          const rowB = wordRows[j];
          let hasCrossing = false;

          // Check row A for modifiers targeting row B
          for (let c = 0; c < grid.cols && !hasCrossing; c++) {
            for (const rule of getCellRuleTiles(grid.cells[rowA][c])) {
              if (rule.type === 'hardMatch' && rule.constraint.pairedRow === rowB) { hasCrossing = true; break; }
              if ((rule.type === 'softMatch' || rule.type === 'forbiddenMatch') &&
                  softForbiddenTargetRows(rule.constraint).includes(rowB)) { hasCrossing = true; break; }
            }
          }

          // Check row B for modifiers targeting row A
          for (let c = 0; c < grid.cols && !hasCrossing; c++) {
            for (const rule of getCellRuleTiles(grid.cells[rowB][c])) {
              if (rule.type === 'hardMatch' && rule.constraint.pairedRow === rowA) { hasCrossing = true; break; }
              if ((rule.type === 'softMatch' || rule.type === 'forbiddenMatch') &&
                  softForbiddenTargetRows(rule.constraint).includes(rowA)) { hasCrossing = true; break; }
            }
          }

          expect(hasCrossing).toBe(true);
        }
      }
    },
  );

  it.each(['bridge', 'semi'] as const)(
    '%s: adjacent-row boundary connectivity holds (exempt fully-fixed boundaries)',
    (puzzleType) => {
      for (let i = 0; i < FUZZ_ITERATIONS; i++) {
        const grid = generateGridFast(puzzleType, 'easy');
        const wordRows = findWordRows(grid);

        for (let j = 1; j < wordRows.length; j++) {
          const rowA = wordRows[j - 1];
          const rowB = wordRows[j];

          // Skip boundaries adjacent to fully-fixed rows (can't carry modifiers in easy)
          const aFixed = getAccessibleCells(grid, rowA).every(c => c.fixed);
          const bFixed = getAccessibleCells(grid, rowB).every(c => c.fixed);
          if (aFixed || bFixed) continue;

          let hasCrossing = false;

          for (let c = 0; c < grid.cols && !hasCrossing; c++) {
            for (const rule of getCellRuleTiles(grid.cells[rowA][c])) {
              if (rule.type === 'hardMatch' && rule.constraint.pairedRow === rowB) { hasCrossing = true; break; }
              if ((rule.type === 'softMatch' || rule.type === 'forbiddenMatch') &&
                  softForbiddenTargetRows(rule.constraint).includes(rowB)) { hasCrossing = true; break; }
            }
          }

          for (let c = 0; c < grid.cols && !hasCrossing; c++) {
            for (const rule of getCellRuleTiles(grid.cells[rowB][c])) {
              if (rule.type === 'hardMatch' && rule.constraint.pairedRow === rowA) { hasCrossing = true; break; }
              if ((rule.type === 'softMatch' || rule.type === 'forbiddenMatch') &&
                  softForbiddenTargetRows(rule.constraint).includes(rowA)) { hasCrossing = true; break; }
            }
          }

          expect(hasCrossing).toBe(true);
        }
      }
    },
  );
});

// =============================================================================
// Forbidden modifiers from backfill
// =============================================================================

describe('ensureMinimumRuleTiles includes forbidden', () => {
  it('generated puzzles sometimes contain forbidden modifiers', () => {
    let sawForbidden = false;
    for (let i = 0; i < 500 && !sawForbidden; i++) {
      const grid = generateGridFast('open', 'easy');
      for (let r = 0; r < grid.rows; r++) {
        for (let c = 0; c < grid.cols; c++) {
          for (const rule of getCellRuleTiles(grid.cells[r][c])) {
            if (rule.type === 'forbiddenMatch') sawForbidden = true;
          }
        }
      }
    }
    expect(sawForbidden).toBe(true);
  });
});
