import { PuzzleGenerator } from './PuzzleGenerator';
import { parseGrid, serializeGrid } from './PuzzleNotation';
import { dictionary } from './Dictionary';
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
    dictionary.initialize();
  });

  function generateAndParse(puzzleType: PuzzleType): Grid {
    const gen = new PuzzleGenerator();
    const puzzleString = gen.generatePuzzle(puzzleType);
    return parseGrid(puzzleString);
  }

  describe('generatePuzzle output shape', () => {
    it('should produce a parseable puzzle string for open mode', () => {
      const gen = new PuzzleGenerator();
      const str = gen.generatePuzzle('open');
      const grid = parseGrid(str);
      expect(grid.rows).toBeGreaterThan(0);
      expect(grid.cols).toBeGreaterThan(0);
    });

    it('should produce a parseable puzzle string for bridge mode', () => {
      const gen = new PuzzleGenerator();
      const str = gen.generatePuzzle('bridge');
      const grid = parseGrid(str);
      expect(grid.rows).toBeGreaterThan(0);
    });

    it('should produce a parseable puzzle string for semi mode', () => {
      const gen = new PuzzleGenerator();
      const str = gen.generatePuzzle('semi');
      const grid = parseGrid(str);
      expect(grid.rows).toBeGreaterThan(0);
    });
  });

  describe('bridge mode shape', () => {
    it('should have first and last word rows fully fixed', () => {
      const grid = generateAndParse('bridge');
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
      const grid = generateAndParse('bridge');
      const wordRows = findWordRows(grid);
      const firstWord = getWordFromRow(grid, wordRows[0]);
      const lastWord = getWordFromRow(grid, wordRows[wordRows.length - 1]);

      expect(dictionary.isValidWord(firstWord)).toBe(true);
      expect(dictionary.isValidWord(lastWord)).toBe(true);
    });
  });

  describe('semi mode shape', () => {
    it('should have only last word row fully fixed', () => {
      const grid = generateAndParse('semi');
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
      const grid = generateAndParse('open');
      const wordRows = findWordRows(grid);

      for (const row of wordRows) {
        const allFixed = getAccessibleCells(grid, row).every(c => c.fixed);
        expect(allFixed).toBe(false);
      }
    });
  });

  describe('conflict guards', () => {
    it('should never place hard match on fixed cells', () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const grid = generateAndParse('bridge');
        for (let r = 0; r < grid.rows; r++) {
          for (let c = 0; c < grid.cols; c++) {
            const cell = grid.cells[r][c];
            if (cell.fixed && cell.ruleTile?.type === 'hardMatch') {
              fail(`Fixed cell at (${r},${c}) has hardMatch tile`);
            }
          }
        }
      }
    });

    it('should never place soft match on fixed cells', () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const grid = generateAndParse('bridge');
        for (let r = 0; r < grid.rows; r++) {
          for (let c = 0; c < grid.cols; c++) {
            const cell = grid.cells[r][c];
            if (cell.fixed && cell.ruleTile?.type === 'softMatch') {
              fail(`Fixed cell at (${r},${c}) has softMatch tile`);
            }
          }
        }
      }
    });

    it('should never place forbidden match on fixed cells', () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const grid = generateAndParse('bridge');
        for (let r = 0; r < grid.rows; r++) {
          for (let c = 0; c < grid.cols; c++) {
            const cell = grid.cells[r][c];
            if (cell.fixed && cell.ruleTile?.type === 'forbiddenMatch') {
              fail(`Fixed cell at (${r},${c}) has forbiddenMatch tile`);
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
            const grid = generateAndParse(puzzleType);
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
            const grid = generateAndParse(puzzleType);
            for (let r = 0; r < grid.rows; r++) {
              if (!isRowComplete(grid, r)) continue;
              expect(validateNoHardMatchForbiddenConflict(grid, r)).toBe(true);
            }
          }
        });

        it(`should have valid hard match pairs on completed rows (${ITERATIONS} puzzles)`, () => {
          for (let i = 0; i < ITERATIONS; i++) {
            const grid = generateAndParse(puzzleType);
            for (let r = 0; r < grid.rows; r++) {
              if (!isRowComplete(grid, r)) continue;
              expect(validateHardMatchTiles(grid, r)).toBe(true);
            }
          }
        });

        it(`should have valid soft match on completed rows (${ITERATIONS} puzzles)`, () => {
          for (let i = 0; i < ITERATIONS; i++) {
            const grid = generateAndParse(puzzleType);
            for (let r = 0; r < grid.rows; r++) {
              if (!isRowComplete(grid, r)) continue;
              expect(validateSoftMatchTiles(grid, r)).toBe(true);
            }
          }
        });

        it(`should have valid forbidden match on completed rows (${ITERATIONS} puzzles)`, () => {
          for (let i = 0; i < ITERATIONS; i++) {
            const grid = generateAndParse(puzzleType);
            for (let r = 0; r < grid.rows; r++) {
              if (!isRowComplete(grid, r)) continue;
              expect(validateForbiddenMatchTiles(grid, r)).toBe(true);
            }
          }
        });

        it(`should round-trip cleanly through serialize/parse (${ITERATIONS} puzzles)`, () => {
          const gen = new PuzzleGenerator();
          for (let i = 0; i < ITERATIONS; i++) {
            const original = gen.generatePuzzle(puzzleType);
            const roundTripped = serializeGrid(parseGrid(original));
            expect(roundTripped).toBe(original);
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
