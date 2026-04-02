import { PuzzleGenerator } from './PuzzleGenerator';
import { parseGrid, serializeGrid } from './PuzzleNotation';
import { generatorDictionary } from './Dictionary';
import { Grid, PuzzleType, Difficulty, PuzzleConfig, lastWordSlotRow, softForbiddenTargetRows } from './types';
import {
  validateHardMatchTiles,
  validateSoftMatchTiles,
  validateForbiddenMatchTiles,
  validateNoHardMatchForbiddenConflict,
  isRowComplete,
} from './GameLogic';

const ITERATIONS = 5000;

describe('PuzzleGenerator', () => {
  beforeAll(() => {
    generatorDictionary.initialize();
  });

  /** Fast path: generates a validated grid without running difficulty simulation. */
  function generateGridFast(puzzleType: PuzzleType, difficulty: Difficulty = 'medium'): Grid {
    const gen = new PuzzleGenerator();
    const maxAttempts = difficulty === 'hard' ? 200 : 50;
    for (let i = 0; i < maxAttempts; i++) {
      const config = gen.generatePuzzleConfig(0, 0, puzzleType);
      const grid = gen.createGridFromConfig(config, puzzleType, difficulty);
      if (gen.isGridValid(grid)) return grid;
    }
    throw new Error(`Failed to generate valid grid in ${maxAttempts} attempts`);
  }

  describe('generatePuzzle output shape', () => {
    it('should produce a parseable puzzle string for open mode', () => {
      const gen = new PuzzleGenerator();
      const { puzzle } = gen.generatePuzzle('open');
      const grid = parseGrid(puzzle);
      expect(grid.rows).toBeGreaterThan(0);
      expect(grid.cols).toBeGreaterThan(0);
    });

    it('should produce a parseable puzzle string for bridge mode', () => {
      const gen = new PuzzleGenerator();
      const { puzzle } = gen.generatePuzzle('bridge');
      const grid = parseGrid(puzzle);
      expect(grid.rows).toBeGreaterThan(0);
    });

    it('should produce a parseable puzzle string for semi mode', () => {
      const gen = new PuzzleGenerator();
      const { puzzle } = gen.generatePuzzle('semi');
      const grid = parseGrid(puzzle);
      expect(grid.rows).toBeGreaterThan(0);
    });

    it('should include difficulty metadata in the result', () => {
      const gen = new PuzzleGenerator();
      const result = gen.generatePuzzle('bridge');
      expect(['easy', 'medium', 'hard']).toContain(result.difficulty);
      expect(result.successRate).toBeGreaterThanOrEqual(0);
      expect(result.successRate).toBeLessThanOrEqual(1);
      expect(typeof result.puzzle).toBe('string');
    });
  });

  describe('bridge mode shape', () => {
    it('should have first and last word rows fully fixed', () => {
      const grid = generateGridFast('bridge');
      const wordRows = findWordRows(grid);
      const firstRow = wordRows[0];
      const lastRow = wordRows[wordRows.length - 1];

      for (let c = 0; c < grid.cols; c++) {
        if (grid.cells[firstRow][c].accessible) {
          expect(grid.cells[firstRow][c].fixed).toBe(true);
          expect(grid.cells[firstRow][c].letter).toBeTruthy();
        }
        if (grid.cells[lastRow][c].accessible) {
          expect(grid.cells[lastRow][c].fixed).toBe(true);
          expect(grid.cells[lastRow][c].letter).toBeTruthy();
        }
      }
    });

    it('should have fixed words that are valid dictionary words', () => {
      const grid = generateGridFast('bridge');
      const wordRows = findWordRows(grid);
      const firstWord = getWordFromRow(grid, wordRows[0]);
      const lastWord = getWordFromRow(grid, wordRows[wordRows.length - 1]);

      expect(generatorDictionary.isValidWord(firstWord)).toBe(true);
      expect(generatorDictionary.isValidWord(lastWord)).toBe(true);
    });
  });

  describe('semi mode shape', () => {
    it('should have only last word row fully fixed', () => {
      const grid = generateGridFast('semi');
      const wordRows = findWordRows(grid);
      const firstRow = wordRows[0];
      const lastRow = wordRows[wordRows.length - 1];

      // First row should NOT be fully fixed
      const firstRowFixed = getAccessibleCells(grid, firstRow).every(c => c.fixed);
      expect(firstRowFixed).toBe(false);

      // Last row should be fully fixed
      for (let c = 0; c < grid.cols; c++) {
        if (grid.cells[lastRow][c].accessible) {
          expect(grid.cells[lastRow][c].fixed).toBe(true);
        }
      }
    });
  });

  describe('open mode shape', () => {
    it('should have no fully-fixed word rows', () => {
      const grid = generateGridFast('open');
      const wordRows = findWordRows(grid);

      for (const row of wordRows) {
        const allFixed = getAccessibleCells(grid, row).every(c => c.fixed);
        expect(allFixed).toBe(false);
      }
    });
  });

  describe('conflict guards', () => {
    it('should allow rule tiles on fixed cells in bridge mode', () => {
      let foundRuleOnFixed = false;
      for (let i = 0; i < ITERATIONS && !foundRuleOnFixed; i++) {
        const grid = generateGridFast('bridge');
        for (let r = 0; r < grid.rows; r++) {
          for (let c = 0; c < grid.cols; c++) {
            const cell = grid.cells[r][c];
            if (cell.fixed && cell.ruleTile) {
              foundRuleOnFixed = true;
            }
          }
        }
      }
      expect(foundRuleOnFixed).toBe(true);
    });

    it('should never have hard match between two fixed cells with different letters', () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const grid = generateGridFast('bridge');
        for (let r = 0; r < grid.rows; r++) {
          for (let c = 0; c < grid.cols; c++) {
            const cell = grid.cells[r][c];
            if (cell.ruleTile?.type !== 'hardMatch' || cell.ruleTile.constraint.position !== 'top') continue;
            const { pairedRow, pairedCol } = cell.ruleTile.constraint;
            const paired = grid.cells[pairedRow]?.[pairedCol];
            if (cell.fixed && paired?.fixed) {
              expect(cell.letter).toBe(paired.letter);
            }
          }
        }
      }
    });
  });

  describe('property tests - no impossible constraints', () => {

    for (const puzzleType of ['open', 'bridge', 'semi'] as PuzzleType[]) {
      describe(`${puzzleType} mode`, () => {
        it(`should never have hard match pairs with mismatched fixed letters (${ITERATIONS} puzzles)`, () => {
          for (let i = 0; i < ITERATIONS; i++) {
            const grid = generateGridFast(puzzleType);
            for (let r = 0; r < grid.rows; r++) {
              for (let c = 0; c < grid.cols; c++) {
                const cell = grid.cells[r][c];
                if (cell.ruleTile?.type !== 'hardMatch' || cell.ruleTile.constraint.position !== 'top') continue;
                const { pairedRow, pairedCol } = cell.ruleTile.constraint;
                const paired = grid.cells[pairedRow]?.[pairedCol];
                if (cell.fixed && paired?.fixed) {
                  expect(cell.letter).toBe(paired.letter);
                }
              }
            }
          }
        });

        it(`should pass validateNoHardMatchForbiddenConflict for all rows (${ITERATIONS} puzzles)`, () => {
          for (let i = 0; i < ITERATIONS; i++) {
            const grid = generateGridFast(puzzleType);
            for (let r = 0; r < grid.rows; r++) {
              if (!isRowComplete(grid, r)) continue;
              expect(validateNoHardMatchForbiddenConflict(grid, r)).toBe(true);
            }
          }
        });

        it(`should have valid hard match pairs on completed rows (${ITERATIONS} puzzles)`, () => {
          for (let i = 0; i < ITERATIONS; i++) {
            const grid = generateGridFast(puzzleType);
            for (let r = 0; r < grid.rows; r++) {
              if (!isRowComplete(grid, r)) continue;
              expect(validateHardMatchTiles(grid, r)).toBe(true);
            }
          }
        });

        it(`should have valid soft match on completed rows (${ITERATIONS} puzzles)`, () => {
          for (let i = 0; i < ITERATIONS; i++) {
            const grid = generateGridFast(puzzleType);
            for (let r = 0; r < grid.rows; r++) {
              if (!isRowComplete(grid, r)) continue;
              expect(validateSoftMatchTiles(grid, r)).toBe(true);
            }
          }
        });

        it(`should never have a fixed soft match whose letter is already fixed in the target row (${ITERATIONS} puzzles)`, () => {
          for (let i = 0; i < ITERATIONS; i++) {
            const grid = generateGridFast(puzzleType);
            for (let r = 0; r < grid.rows; r++) {
              for (let c = 0; c < grid.cols; c++) {
                const cell = grid.cells[r][c];
                if (cell.ruleTile?.type !== 'softMatch' || !cell.fixed || !cell.letter) continue;
                for (const targetRow of softForbiddenTargetRows(cell.ruleTile.constraint)) {
                  const targetCells = grid.cells[targetRow];
                  const hasTrivialMatch = targetCells.some(
                    tc => tc.accessible && tc.fixed && tc.letter === cell.letter,
                  );
                  expect(hasTrivialMatch).toBe(false);
                }
              }
            }
          }
        });

        it(`should have valid forbidden match on completed rows (${ITERATIONS} puzzles)`, () => {
          for (let i = 0; i < ITERATIONS; i++) {
            const grid = generateGridFast(puzzleType);
            for (let r = 0; r < grid.rows; r++) {
              if (!isRowComplete(grid, r)) continue;
              expect(validateForbiddenMatchTiles(grid, r)).toBe(true);
            }
          }
        });

        it(`should round-trip cleanly through serialize/parse (${ITERATIONS} puzzles)`, () => {
          const gen = new PuzzleGenerator();
          for (let i = 0; i < ITERATIONS; i++) {
            const grid = gen.createGridFromConfig(
              gen.generatePuzzleConfig(0, 0, puzzleType),
              puzzleType,
            );
            const serialized = serializeGrid(grid);
            const roundTripped = serializeGrid(parseGrid(serialized));
            expect(roundTripped).toBe(serialized);
          }
        });
      });
    }

    const HARD_ROUND_TRIP_ITERATIONS = 400;

    it(`should round-trip hard-difficulty open grids through serialize/parse (${HARD_ROUND_TRIP_ITERATIONS} puzzles)`, () => {
      for (let i = 0; i < HARD_ROUND_TRIP_ITERATIONS; i++) {
        const grid = generateGridFast('open', 'hard');
        const serialized = serializeGrid(grid);
        const roundTripped = serializeGrid(parseGrid(serialized));
        expect(roundTripped).toBe(serialized);
      }
    });
  });

  describe('soft/forbidden direction gating', () => {
    function generateValidGridAndConfig(
      puzzleType: PuzzleType,
      difficulty: Difficulty,
    ): { grid: Grid; config: PuzzleConfig } {
      const gen = new PuzzleGenerator();
      const maxAttempts = difficulty === 'hard' ? 300 : 50;
      for (let i = 0; i < maxAttempts; i++) {
        const config = gen.generatePuzzleConfig(0, 0, puzzleType);
        const grid = gen.createGridFromConfig(config, puzzleType, difficulty);
        if (gen.isGridValid(grid)) return { grid, config };
      }
      throw new Error(`Failed to generate valid ${puzzleType}/${difficulty} grid`);
    }

    function assertNoNextRowSoftForbiddenOnRow(grid: Grid, row: number): void {
      for (let c = 0; c < grid.cols; c++) {
        const t = grid.cells[row][c].ruleTile;
        if (t?.type === 'softMatch' || t?.type === 'forbiddenMatch') {
          expect(t.constraint.nextRow).toBeUndefined();
        }
      }
    }

    it('never sets prevRow on soft or forbidden tiles for easy and medium', () => {
      for (const difficulty of ['easy', 'medium'] as const) {
        for (let i = 0; i < 150; i++) {
          const grid = generateGridFast('open', difficulty);
          for (let r = 0; r < grid.rows; r++) {
            for (let c = 0; c < grid.cols; c++) {
              const t = grid.cells[r][c].ruleTile;
              if (t?.type === 'softMatch' || t?.type === 'forbiddenMatch') {
                expect(t.constraint.prevRow).toBeUndefined();
              }
            }
          }
        }
      }
    });

    describe('last word row must not use nextRow (downward constraint)', () => {
      const HARD_ITERS_PER_MODE = 400;

      it.each(['open', 'bridge', 'semi'] as const)(
        'hard %s: fresh grid — no nextRow on lastWordSlotRow(config)',
        puzzleType => {
          for (let i = 0; i < HARD_ITERS_PER_MODE; i++) {
            const { grid, config } = generateValidGridAndConfig(puzzleType, 'hard');
            assertNoNextRowSoftForbiddenOnRow(grid, lastWordSlotRow(config));
          }
        },
      );

      it.each(['open', 'bridge', 'semi'] as const)(
        'hard %s: after serialize → parse — same bottom row index and still no nextRow there',
        puzzleType => {
          for (let i = 0; i < HARD_ITERS_PER_MODE; i++) {
            const { grid, config } = generateValidGridAndConfig(puzzleType, 'hard');
            const bottom = lastWordSlotRow(config);
            const parsed = parseGrid(serializeGrid(grid));
            const topologyBottom = findWordRows(parsed);
            expect(topologyBottom[topologyBottom.length - 1]).toBe(bottom);
            assertNoNextRowSoftForbiddenOnRow(parsed, bottom);
          }
        },
      );

      it('easy and medium (open): no nextRow on config bottom word row', () => {
        for (const difficulty of ['easy', 'medium'] as const) {
          for (let i = 0; i < 200; i++) {
            const { grid, config } = generateValidGridAndConfig('open', difficulty);
            assertNoNextRowSoftForbiddenOnRow(grid, lastWordSlotRow(config));
          }
        }
      });

      it('hard open: topology bottom row matches config and has no downward soft/forbidden', () => {
        for (let i = 0; i < 500; i++) {
          const { grid, config } = generateValidGridAndConfig('open', 'hard');
          const fromConfig = lastWordSlotRow(config);
          const fromTopology = findWordRows(grid);
          expect(fromTopology[fromTopology.length - 1]).toBe(fromConfig);
          assertNoNextRowSoftForbiddenOnRow(grid, fromConfig);
        }
      });
    });

    it('sometimes sets prevRow on soft or forbidden for hard', () => {
      let sawPrev = false;
      const gen = new PuzzleGenerator();
      for (let i = 0; i < 4000; i++) {
        const config = gen.generatePuzzleConfig(0, 0, 'open');
        const grid = gen.createGridFromConfig(config, 'open', 'hard');
        if (!gen.isGridValid(grid)) continue;
        for (let r = 0; r < grid.rows; r++) {
          for (let c = 0; c < grid.cols; c++) {
            const t = grid.cells[r][c].ruleTile;
            if (
              (t?.type === 'softMatch' || t?.type === 'forbiddenMatch') &&
              t.constraint.prevRow !== undefined
            ) {
              sawPrev = true;
              break;
            }
          }
          if (sawPrev) break;
        }
        if (sawPrev) break;
      }
      expect(sawPrev).toBe(true);
    });

    it('hard mode keeps at most two rules per cell', () => {
      for (let i = 0; i < 300; i++) {
        const grid = generateGridFast('open', 'hard');
        for (let r = 0; r < grid.rows; r++) {
          for (let c = 0; c < grid.cols; c++) {
            const count = grid.cells[r][c].ruleTiles?.length ?? (grid.cells[r][c].ruleTile ? 1 : 0);
            expect(count).toBeLessThanOrEqual(2);
          }
        }
      }
    });

    it('hard mode combined directional rules are bidirectional', () => {
      for (let i = 0; i < 250; i++) {
        const grid = generateGridFast('open', 'hard');
        for (let r = 0; r < grid.rows; r++) {
          for (let c = 0; c < grid.cols; c++) {
            const rules = grid.cells[r][c].ruleTiles ?? (grid.cells[r][c].ruleTile ? [grid.cells[r][c].ruleTile!] : []);
            if (rules.length < 2) continue;
            for (const rule of rules) {
              if (rule.type === 'softMatch' || rule.type === 'forbiddenMatch') {
                const hasDirectionalPart =
                  rule.constraint.nextRow !== undefined || rule.constraint.prevRow !== undefined;
                if (hasDirectionalPart) {
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
});

// Helpers

function findWordRows(grid: Grid): number[] {
  const rows: number[] = [];
  for (let r = 0; r < grid.rows; r++) {
    if (grid.cells[r].some(c => c.accessible)) {
      rows.push(r);
    }
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
