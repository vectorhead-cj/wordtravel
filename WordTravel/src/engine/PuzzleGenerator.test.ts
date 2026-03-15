import { PuzzleGenerator } from './PuzzleGenerator';
import { parseGrid, serializeGrid } from './PuzzleNotation';
import { generatorDictionary } from './Dictionary';
import { Grid, PuzzleType } from './types';
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
  function generateGridFast(puzzleType: PuzzleType): Grid {
    const gen = new PuzzleGenerator();
    for (let i = 0; i < 50; i++) {
      const config = gen.generatePuzzleConfig(0, 0, puzzleType);
      const grid = gen.createGridFromConfig(config, puzzleType);
      if (gen.isGridValid(grid)) return grid;
    }
    throw new Error('Failed to generate valid grid in 50 attempts');
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
