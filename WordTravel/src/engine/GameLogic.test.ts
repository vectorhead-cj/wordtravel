import {
  validateSpelling,
  validateHardMatchTiles,
  validateSoftMatchTiles,
  validateUniqueWords,
  getRowValidationState,
} from './GameLogic';
import { Grid, Cell, HardMatchTile, SoftMatchTile, RuleTile } from './types';
import { dictionary } from './Dictionary';

function createTestCell(
  letter: string | null = null,
  accessible: boolean = true,
  ruleTile?: RuleTile
): Cell {
  return {
    letter,
    accessible,
    ruleTile,
    state: 'empty',
    validation: 'none',
  };
}

function createTestGrid(cells: Cell[][]): Grid {
  return {
    rows: cells.length,
    cols: cells[0]?.length || 0,
    cells,
  };
}

describe('GameLogic Validation', () => {
  beforeAll(() => {
    dictionary.initialize();
  });

  describe('validateSpelling', () => {
    it('should return false for non-dictionary words', () => {
      const grid = createTestGrid([
        [
          createTestCell('X', true),
          createTestCell('Y', true),
          createTestCell('Z', true),
        ],
      ]);
      expect(validateSpelling(grid, 0)).toBe(false);
    });

    it('should handle empty row', () => {
      const grid = createTestGrid([
        [
          createTestCell(null, true),
          createTestCell(null, true),
          createTestCell(null, true),
        ],
      ]);
      expect(validateSpelling(grid, 0)).toBe(true);
    });

    it('should handle mixed accessible and inaccessible cells', () => {
      const grid = createTestGrid([
        [
          createTestCell('C', false),
          createTestCell('A', true),
          createTestCell('T', true),
          createTestCell('X', false),
        ],
      ]);
      expect(validateSpelling(grid, 0)).toBe(true);
    });
  });

  describe('validateHardMatchTiles', () => {
    it('should return true when no rule tiles exist', () => {
      const grid = createTestGrid([
        [createTestCell('A', true), createTestCell('B', true)],
        [createTestCell('C', true), createTestCell('D', true)],
      ]);
      expect(validateHardMatchTiles(grid, 0)).toBe(true);
    });

    it('should return true when paired letters match', () => {
      const topTile: HardMatchTile = {
        type: 'hardMatch',
        constraint: {
          pairedRow: 1,
          pairedCol: 0,
          position: 'top',
        },
      };

      const bottomTile: HardMatchTile = {
        type: 'hardMatch',
        constraint: {
          pairedRow: 0,
          pairedCol: 0,
          position: 'bottom',
        },
      };

      const grid = createTestGrid([
        [createTestCell('A', true, topTile), createTestCell('B', true)],
        [createTestCell('A', true, bottomTile), createTestCell('C', true)],
      ]);

      expect(validateHardMatchTiles(grid, 0)).toBe(true);
      expect(validateHardMatchTiles(grid, 1)).toBe(true);
    });

    it('should return false when paired letters do not match', () => {
      const topTile: HardMatchTile = {
        type: 'hardMatch',
        constraint: {
          pairedRow: 1,
          pairedCol: 0,
          position: 'top',
        },
      };

      const bottomTile: HardMatchTile = {
        type: 'hardMatch',
        constraint: {
          pairedRow: 0,
          pairedCol: 0,
          position: 'bottom',
        },
      };

      const grid = createTestGrid([
        [createTestCell('A', true, topTile), createTestCell('B', true)],
        [createTestCell('X', true, bottomTile), createTestCell('C', true)],
      ]);

      expect(validateHardMatchTiles(grid, 0)).toBe(false);
    });

    it('should handle multiple pairs in same row', () => {
      const tile1Top: HardMatchTile = {
        type: 'hardMatch',
        constraint: { pairedRow: 1, pairedCol: 0, position: 'top' },
      };
      const tile2Top: HardMatchTile = {
        type: 'hardMatch',
        constraint: { pairedRow: 1, pairedCol: 2, position: 'top' },
      };

      const tile1Bottom: HardMatchTile = {
        type: 'hardMatch',
        constraint: { pairedRow: 0, pairedCol: 0, position: 'bottom' },
      };
      const tile2Bottom: HardMatchTile = {
        type: 'hardMatch',
        constraint: { pairedRow: 0, pairedCol: 2, position: 'bottom' },
      };

      const grid = createTestGrid([
        [
          createTestCell('A', true, tile1Top),
          createTestCell('B', true),
          createTestCell('C', true, tile2Top),
        ],
        [
          createTestCell('A', true, tile1Bottom),
          createTestCell('X', true),
          createTestCell('C', true, tile2Bottom),
        ],
      ]);

      expect(validateHardMatchTiles(grid, 0)).toBe(true);
      expect(validateHardMatchTiles(grid, 1)).toBe(true);
    });

    it('should return false when one of multiple pairs does not match', () => {
      const tile1Top: HardMatchTile = {
        type: 'hardMatch',
        constraint: { pairedRow: 1, pairedCol: 0, position: 'top' },
      };
      const tile2Top: HardMatchTile = {
        type: 'hardMatch',
        constraint: { pairedRow: 1, pairedCol: 2, position: 'top' },
      };

      const tile1Bottom: HardMatchTile = {
        type: 'hardMatch',
        constraint: { pairedRow: 0, pairedCol: 0, position: 'bottom' },
      };
      const tile2Bottom: HardMatchTile = {
        type: 'hardMatch',
        constraint: { pairedRow: 0, pairedCol: 2, position: 'bottom' },
      };

      const grid = createTestGrid([
        [
          createTestCell('A', true, tile1Top),
          createTestCell('B', true),
          createTestCell('C', true, tile2Top),
        ],
        [
          createTestCell('A', true, tile1Bottom),
          createTestCell('X', true),
          createTestCell('Z', true, tile2Bottom), // Mismatch
        ],
      ]);

      expect(validateHardMatchTiles(grid, 0)).toBe(false);
    });

    it('should handle null letters in paired cells', () => {
      const topTile: HardMatchTile = {
        type: 'hardMatch',
        constraint: { pairedRow: 1, pairedCol: 0, position: 'top' },
      };

      const bottomTile: HardMatchTile = {
        type: 'hardMatch',
        constraint: { pairedRow: 0, pairedCol: 0, position: 'bottom' },
      };

      const grid = createTestGrid([
        [createTestCell(null, true, topTile), createTestCell('B', true)],
        [createTestCell(null, true, bottomTile), createTestCell('C', true)],
      ]);

      expect(validateHardMatchTiles(grid, 0)).toBe(true);
    });
  });

  describe('validateSoftMatchTiles', () => {
    it('should return true when no rule tiles exist', () => {
      const grid = createTestGrid([
        [createTestCell('A', true), createTestCell('B', true)],
        [createTestCell('C', true), createTestCell('D', true)],
      ]);
      expect(validateSoftMatchTiles(grid, 0)).toBe(true);
      expect(validateSoftMatchTiles(grid, 1)).toBe(true);
    });

    it('should return true when validating source row (never fails on source)', () => {
      const ruleTile: SoftMatchTile = {
        type: 'softMatch',
        constraint: { nextRow: 1 },
      };

      const grid = createTestGrid([
        [createTestCell('A', true, ruleTile), createTestCell('B', true)],
        [createTestCell('X', true), createTestCell('Y', true)],
      ]);

      expect(validateSoftMatchTiles(grid, 0)).toBe(true);
    });

    it('should return true when target row contains the required letter', () => {
      const ruleTile: SoftMatchTile = {
        type: 'softMatch',
        constraint: { nextRow: 1 },
      };

      const grid = createTestGrid([
        [createTestCell('A', true, ruleTile), createTestCell('B', true)],
        [createTestCell('C', true), createTestCell('A', true)],
      ]);

      expect(validateSoftMatchTiles(grid, 1)).toBe(true);
    });

    it('should return false when target row does not contain required letter', () => {
      const ruleTile: SoftMatchTile = {
        type: 'softMatch',
        constraint: { nextRow: 1 },
      };

      const grid = createTestGrid([
        [createTestCell('A', true, ruleTile), createTestCell('B', true)],
        [createTestCell('X', true), createTestCell('Y', true)],
      ]);

      expect(validateSoftMatchTiles(grid, 1)).toBe(false);
    });

    it('should handle multiple SoftMatchTiles pointing to same target row', () => {
      const ruleTile1: SoftMatchTile = {
        type: 'softMatch',
        constraint: { nextRow: 2 },
      };
      const ruleTile2: SoftMatchTile = {
        type: 'softMatch',
        constraint: { nextRow: 2 },
      };

      const grid = createTestGrid([
        [createTestCell('A', true, ruleTile1), createTestCell('B', true)],
        [createTestCell('C', true, ruleTile2), createTestCell('D', true)],
        [createTestCell('A', true), createTestCell('C', true)],
      ]);

      expect(validateSoftMatchTiles(grid, 2)).toBe(true);
    });

    it('should return false when one of multiple required letters is missing', () => {
      const ruleTile1: SoftMatchTile = {
        type: 'softMatch',
        constraint: { nextRow: 2 },
      };
      const ruleTile2: SoftMatchTile = {
        type: 'softMatch',
        constraint: { nextRow: 2 },
      };

      const grid = createTestGrid([
        [createTestCell('A', true, ruleTile1), createTestCell('B', true)],
        [createTestCell('C', true, ruleTile2), createTestCell('D', true)],
        [createTestCell('A', true), createTestCell('X', true)], // Missing 'C'
      ]);

      expect(validateSoftMatchTiles(grid, 2)).toBe(false);
    });

    it('should handle letter appearing multiple times in target row', () => {
      const ruleTile: SoftMatchTile = {
        type: 'softMatch',
        constraint: { nextRow: 1 },
      };

      const grid = createTestGrid([
        [createTestCell('A', true, ruleTile), createTestCell('B', true)],
        [createTestCell('A', true), createTestCell('A', true)],
      ]);

      expect(validateSoftMatchTiles(grid, 1)).toBe(true);
    });

    it('should ignore inaccessible cells in target row', () => {
      const ruleTile: SoftMatchTile = {
        type: 'softMatch',
        constraint: { nextRow: 1 },
      };

      const grid = createTestGrid([
        [createTestCell('A', true, ruleTile), createTestCell('B', true)],
        [createTestCell('A', false), createTestCell('X', true)],
      ]);

      expect(validateSoftMatchTiles(grid, 1)).toBe(false);
    });

    it('should skip check when source row is incomplete', () => {
      const ruleTile: SoftMatchTile = {
        type: 'softMatch',
        constraint: { nextRow: 1 },
      };

      const grid = createTestGrid([
        [createTestCell(null, true, ruleTile), createTestCell('B', true)],
        [createTestCell('X', true), createTestCell('Y', true)],
      ]);

      expect(validateSoftMatchTiles(grid, 1)).toBe(true);
    });
  });

  describe('validateUniqueWords', () => {
    it('should return true when grid has only one row', () => {
      const grid = createTestGrid([
        [createTestCell('C', true), createTestCell('A', true), createTestCell('T', true)],
      ]);
      expect(validateUniqueWords(grid, 0)).toBe(true);
    });

    it('should return true when all rows have different words', () => {
      const grid = createTestGrid([
        [createTestCell('C', true), createTestCell('A', true), createTestCell('T', true)],
        [createTestCell('D', true), createTestCell('O', true), createTestCell('G', true)],
        [createTestCell('B', true), createTestCell('A', true), createTestCell('T', true)],
      ]);
      expect(validateUniqueWords(grid, 0)).toBe(true);
      expect(validateUniqueWords(grid, 1)).toBe(true);
      expect(validateUniqueWords(grid, 2)).toBe(true);
    });

    it('should return false when current row word matches another complete row', () => {
      const grid = createTestGrid([
        [createTestCell('C', true), createTestCell('A', true), createTestCell('T', true)],
        [createTestCell('D', true), createTestCell('O', true), createTestCell('G', true)],
        [createTestCell('C', true), createTestCell('A', true), createTestCell('T', true)],
      ]);
      expect(validateUniqueWords(grid, 2)).toBe(false);
    });

    it('should be case insensitive', () => {
      const grid = createTestGrid([
        [createTestCell('c', true), createTestCell('a', true), createTestCell('t', true)],
        [createTestCell('C', true), createTestCell('A', true), createTestCell('T', true)],
      ]);
      expect(validateUniqueWords(grid, 1)).toBe(false);
    });

    it('should return true when comparing to incomplete rows', () => {
      const grid = createTestGrid([
        [createTestCell('C', true), createTestCell('A', true), createTestCell('T', true)],
        [createTestCell('C', true), createTestCell('A', true), createTestCell(null, true)],
      ]);
      expect(validateUniqueWords(grid, 0)).toBe(true);
    });

    it('should handle incomplete current row (empty word)', () => {
      const grid = createTestGrid([
        [createTestCell('C', true), createTestCell('A', true), createTestCell('T', true)],
        [createTestCell('D', true), createTestCell(null, true), createTestCell('G', true)],
      ]);
      expect(validateUniqueWords(grid, 1)).toBe(true);
    });

    it('should handle rows with inaccessible cells', () => {
      const grid = createTestGrid([
        [createTestCell('C', false), createTestCell('A', true), createTestCell('T', true)],
        [createTestCell('X', true), createTestCell('A', true), createTestCell('T', true)],
      ]);
      expect(validateUniqueWords(grid, 0)).toBe(true);
      expect(validateUniqueWords(grid, 1)).toBe(true);
    });

    it('should return false when word appears in multiple other rows', () => {
      const grid = createTestGrid([
        [createTestCell('C', true), createTestCell('A', true), createTestCell('T', true)],
        [createTestCell('D', true), createTestCell('O', true), createTestCell('G', true)],
        [createTestCell('C', true), createTestCell('A', true), createTestCell('T', true)],
        [createTestCell('C', true), createTestCell('A', true), createTestCell('T', true)],
      ]);
      expect(validateUniqueWords(grid, 2)).toBe(false);
      expect(validateUniqueWords(grid, 3)).toBe(false);
    });

    it('should return true for empty word rows', () => {
      const grid = createTestGrid([
        [createTestCell(null, true), createTestCell(null, true), createTestCell(null, true)],
        [createTestCell(null, true), createTestCell(null, true), createTestCell(null, true)],
      ]);
      expect(validateUniqueWords(grid, 0)).toBe(true);
      expect(validateUniqueWords(grid, 1)).toBe(true);
    });

    it('should handle words of different lengths', () => {
      const grid = createTestGrid([
        [createTestCell('C', true), createTestCell('A', true), createTestCell('T', true), createTestCell(null, false)],
        [createTestCell('C', true), createTestCell('A', true), createTestCell('T', true), createTestCell('S', true)],
      ]);
      expect(validateUniqueWords(grid, 0)).toBe(true);
      expect(validateUniqueWords(grid, 1)).toBe(true);
    });

    it('should validate first row against subsequently filled rows', () => {
      const grid = createTestGrid([
        [createTestCell('C', true), createTestCell('A', true), createTestCell('T', true)],
        [createTestCell('C', true), createTestCell('A', true), createTestCell('T', true)],
      ]);
      expect(validateUniqueWords(grid, 0)).toBe(false);
    });
  });

  describe('Combined Rule Validation', () => {
    it('should handle grid with both HardMatch and SoftMatch tiles', () => {
      const positionTileTop: HardMatchTile = {
        type: 'hardMatch',
        constraint: { pairedRow: 1, pairedCol: 0, position: 'top' },
      };
      const positionTileBottom: HardMatchTile = {
        type: 'hardMatch',
        constraint: { pairedRow: 0, pairedCol: 0, position: 'bottom' },
      };
      const letterTile: SoftMatchTile = {
        type: 'softMatch',
        constraint: { nextRow: 2 },
      };

      const grid = createTestGrid([
        [createTestCell('A', true, positionTileTop), createTestCell('B', true)],
        [createTestCell('A', true, positionTileBottom), createTestCell('C', true, letterTile)],
        [createTestCell('X', true), createTestCell('C', true)],
      ]);

      expect(validateHardMatchTiles(grid, 0)).toBe(true);
      expect(validateHardMatchTiles(grid, 1)).toBe(true);
      expect(validateSoftMatchTiles(grid, 2)).toBe(true);
    });

    it('should fail when HardMatch fails but SoftMatch passes', () => {
      const positionTileTop: HardMatchTile = {
        type: 'hardMatch',
        constraint: { pairedRow: 1, pairedCol: 0, position: 'top' },
      };
      const positionTileBottom: HardMatchTile = {
        type: 'hardMatch',
        constraint: { pairedRow: 0, pairedCol: 0, position: 'bottom' },
      };
      const letterTile: SoftMatchTile = {
        type: 'softMatch',
        constraint: { nextRow: 2 },
      };

      const grid = createTestGrid([
        [createTestCell('A', true, positionTileTop), createTestCell('B', true)],
        [createTestCell('X', true, positionTileBottom), createTestCell('C', true, letterTile)],
        [createTestCell('Y', true), createTestCell('C', true)],
      ]);

      expect(validateHardMatchTiles(grid, 0)).toBe(false);
      expect(validateSoftMatchTiles(grid, 2)).toBe(true);
    });

    it('should handle complex multi-row scenario', () => {
      const pos1Top: HardMatchTile = {
        type: 'hardMatch',
        constraint: { pairedRow: 1, pairedCol: 1, position: 'top' },
      };
      const pos1Bottom: HardMatchTile = {
        type: 'hardMatch',
        constraint: { pairedRow: 0, pairedCol: 1, position: 'bottom' },
      };
      const letter1: SoftMatchTile = {
        type: 'softMatch',
        constraint: { nextRow: 1 },
      };
      const letter2: SoftMatchTile = {
        type: 'softMatch',
        constraint: { nextRow: 2 },
      };

      const grid = createTestGrid([
        [createTestCell('A', true, letter1), createTestCell('B', true, pos1Top), createTestCell('C', true)],
        [createTestCell('X', true), createTestCell('B', true, pos1Bottom), createTestCell('A', true, letter2)],
        [createTestCell('Y', true), createTestCell('Z', true), createTestCell('A', true)],
      ]);

      expect(validateHardMatchTiles(grid, 0)).toBe(true);
      expect(validateHardMatchTiles(grid, 1)).toBe(true);
      expect(validateSoftMatchTiles(grid, 1)).toBe(true);
      expect(validateSoftMatchTiles(grid, 2)).toBe(true);
    });
  });

  describe('getRowValidationState', () => {
    it('should return all true for simple valid row', () => {
      const grid = createTestGrid([
        [createTestCell('C', true), createTestCell('A', true), createTestCell('T', true)],
      ]);

      const state = getRowValidationState(grid, 0);
      expect(state.spelling).toBe(true);
      expect(state.hardMatch).toBe(true);
      expect(state.softMatch).toBe(true);
      expect(state.uniqueWords).toBe(true);
      expect(state.hasHardMatchTile).toBe(false);
      expect(state.hasSoftMatchTile).toBe(false);
    });

    it('should detect HardMatchTile presence', () => {
      const positionTile: HardMatchTile = {
        type: 'hardMatch',
        constraint: { pairedRow: 1, pairedCol: 0, position: 'top' },
      };

      const grid = createTestGrid([
        [createTestCell('A', true, positionTile), createTestCell('B', true)],
        [createTestCell('A', true), createTestCell('C', true)],
      ]);

      const state = getRowValidationState(grid, 0);
      expect(state.hasHardMatchTile).toBe(true);
    });

    it('should detect SoftMatchTile as target row', () => {
      const letterTile: SoftMatchTile = {
        type: 'softMatch',
        constraint: { nextRow: 1 },
      };

      const grid = createTestGrid([
        [createTestCell('A', true, letterTile), createTestCell('B', true)],
        [createTestCell('A', true), createTestCell('C', true)],
      ]);

      const state0 = getRowValidationState(grid, 0);
      expect(state0.hasSoftMatchTile).toBe(false);

      const state1 = getRowValidationState(grid, 1);
      expect(state1.hasSoftMatchTile).toBe(true);
    });

    it('should return validation status for all rules', () => {
      const positionTileTop: HardMatchTile = {
        type: 'hardMatch',
        constraint: { pairedRow: 1, pairedCol: 0, position: 'top' },
      };
      const positionTileBottom: HardMatchTile = {
        type: 'hardMatch',
        constraint: { pairedRow: 0, pairedCol: 0, position: 'bottom' },
      };

      const grid = createTestGrid([
        [createTestCell('A', true, positionTileTop), createTestCell('B', true)],
        [createTestCell('X', true, positionTileBottom), createTestCell('C', true)],
      ]);

      const state = getRowValidationState(grid, 0);
      expect(state.spelling).toBe(true);
      expect(state.hardMatch).toBe(false);
      expect(state.softMatch).toBe(true);
      expect(state.uniqueWords).toBe(true);
      expect(state.hasHardMatchTile).toBe(true);
      expect(state.hasSoftMatchTile).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty grid', () => {
      const grid = createTestGrid([[]]);
      expect(validateSpelling(grid, 0)).toBe(true);
      expect(validateHardMatchTiles(grid, 0)).toBe(true);
      expect(validateSoftMatchTiles(grid, 0)).toBe(true);
    });

    it('should handle single cell grid', () => {
      const grid = createTestGrid([[createTestCell('A', true)]]);
      expect(validateSpelling(grid, 0)).toBe(true);
      expect(validateHardMatchTiles(grid, 0)).toBe(true);
      expect(validateSoftMatchTiles(grid, 0)).toBe(true);
    });

    it('should handle all inaccessible cells', () => {
      const grid = createTestGrid([
        [createTestCell('A', false), createTestCell('B', false)],
      ]);
      expect(validateSpelling(grid, 0)).toBe(true);
      expect(validateHardMatchTiles(grid, 0)).toBe(true);
      expect(validateSoftMatchTiles(grid, 0)).toBe(true);
    });

    it('should handle row with no letters filled', () => {
      const grid = createTestGrid([
        [createTestCell(null, true), createTestCell(null, true)],
      ]);
      expect(validateSpelling(grid, 0)).toBe(true);
      expect(validateHardMatchTiles(grid, 0)).toBe(true);
      expect(validateSoftMatchTiles(grid, 0)).toBe(true);
    });

    it('should handle case sensitivity', () => {
      const topTile: HardMatchTile = {
        type: 'hardMatch',
        constraint: { pairedRow: 1, pairedCol: 0, position: 'top' },
      };
      const bottomTile: HardMatchTile = {
        type: 'hardMatch',
        constraint: { pairedRow: 0, pairedCol: 0, position: 'bottom' },
      };

      const grid = createTestGrid([
        [createTestCell('A', true, topTile), createTestCell('B', true)],
        [createTestCell('A', true, bottomTile), createTestCell('C', true)],
      ]);

      expect(validateHardMatchTiles(grid, 0)).toBe(true);
    });
  });
});

