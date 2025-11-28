import {
  validateSpelling,
  validateSameLetterPositionTiles,
  validateSameLetterTiles,
  validateUniqueWords,
  getRowValidationState,
} from './GameLogic';
import { Grid, Cell, SameLetterPositionTile, SameLetterTile, RuleTile } from './types';

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
  describe('validateSpelling', () => {
    it('should return true when dictionary check is disabled', () => {
      const grid = createTestGrid([
        [
          createTestCell('X', true),
          createTestCell('Y', true),
          createTestCell('Z', true),
        ],
      ]);
      expect(validateSpelling(grid, 0)).toBe(true);
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

  describe('validateSameLetterPositionTiles', () => {
    it('should return true when no rule tiles exist', () => {
      const grid = createTestGrid([
        [createTestCell('A', true), createTestCell('B', true)],
        [createTestCell('C', true), createTestCell('D', true)],
      ]);
      expect(validateSameLetterPositionTiles(grid, 0)).toBe(true);
    });

    it('should return true when paired letters match', () => {
      const topTile: SameLetterPositionTile = {
        type: 'sameLetterPosition',
        constraint: {
          pairedRow: 1,
          pairedCol: 0,
          position: 'top',
        },
      };

      const bottomTile: SameLetterPositionTile = {
        type: 'sameLetterPosition',
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

      expect(validateSameLetterPositionTiles(grid, 0)).toBe(true);
      expect(validateSameLetterPositionTiles(grid, 1)).toBe(true);
    });

    it('should return false when paired letters do not match', () => {
      const topTile: SameLetterPositionTile = {
        type: 'sameLetterPosition',
        constraint: {
          pairedRow: 1,
          pairedCol: 0,
          position: 'top',
        },
      };

      const bottomTile: SameLetterPositionTile = {
        type: 'sameLetterPosition',
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

      expect(validateSameLetterPositionTiles(grid, 0)).toBe(false);
    });

    it('should handle multiple pairs in same row', () => {
      const tile1Top: SameLetterPositionTile = {
        type: 'sameLetterPosition',
        constraint: { pairedRow: 1, pairedCol: 0, position: 'top' },
      };
      const tile2Top: SameLetterPositionTile = {
        type: 'sameLetterPosition',
        constraint: { pairedRow: 1, pairedCol: 2, position: 'top' },
      };

      const tile1Bottom: SameLetterPositionTile = {
        type: 'sameLetterPosition',
        constraint: { pairedRow: 0, pairedCol: 0, position: 'bottom' },
      };
      const tile2Bottom: SameLetterPositionTile = {
        type: 'sameLetterPosition',
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

      expect(validateSameLetterPositionTiles(grid, 0)).toBe(true);
      expect(validateSameLetterPositionTiles(grid, 1)).toBe(true);
    });

    it('should return false when one of multiple pairs does not match', () => {
      const tile1Top: SameLetterPositionTile = {
        type: 'sameLetterPosition',
        constraint: { pairedRow: 1, pairedCol: 0, position: 'top' },
      };
      const tile2Top: SameLetterPositionTile = {
        type: 'sameLetterPosition',
        constraint: { pairedRow: 1, pairedCol: 2, position: 'top' },
      };

      const tile1Bottom: SameLetterPositionTile = {
        type: 'sameLetterPosition',
        constraint: { pairedRow: 0, pairedCol: 0, position: 'bottom' },
      };
      const tile2Bottom: SameLetterPositionTile = {
        type: 'sameLetterPosition',
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

      expect(validateSameLetterPositionTiles(grid, 0)).toBe(false);
    });

    it('should handle null letters in paired cells', () => {
      const topTile: SameLetterPositionTile = {
        type: 'sameLetterPosition',
        constraint: { pairedRow: 1, pairedCol: 0, position: 'top' },
      };

      const bottomTile: SameLetterPositionTile = {
        type: 'sameLetterPosition',
        constraint: { pairedRow: 0, pairedCol: 0, position: 'bottom' },
      };

      const grid = createTestGrid([
        [createTestCell(null, true, topTile), createTestCell('B', true)],
        [createTestCell(null, true, bottomTile), createTestCell('C', true)],
      ]);

      expect(validateSameLetterPositionTiles(grid, 0)).toBe(true);
    });
  });

  describe('validateSameLetterTiles', () => {
    it('should return true when no rule tiles exist', () => {
      const grid = createTestGrid([
        [createTestCell('A', true), createTestCell('B', true)],
        [createTestCell('C', true), createTestCell('D', true)],
      ]);
      expect(validateSameLetterTiles(grid, 0)).toBe(true);
      expect(validateSameLetterTiles(grid, 1)).toBe(true);
    });

    it('should return true when validating source row (never fails on source)', () => {
      const ruleTile: SameLetterTile = {
        type: 'sameLetter',
        constraint: { nextRow: 1 },
      };

      const grid = createTestGrid([
        [createTestCell('A', true, ruleTile), createTestCell('B', true)],
        [createTestCell('X', true), createTestCell('Y', true)],
      ]);

      expect(validateSameLetterTiles(grid, 0)).toBe(true);
    });

    it('should return true when target row contains the required letter', () => {
      const ruleTile: SameLetterTile = {
        type: 'sameLetter',
        constraint: { nextRow: 1 },
      };

      const grid = createTestGrid([
        [createTestCell('A', true, ruleTile), createTestCell('B', true)],
        [createTestCell('C', true), createTestCell('A', true)],
      ]);

      expect(validateSameLetterTiles(grid, 1)).toBe(true);
    });

    it('should return false when target row does not contain required letter', () => {
      const ruleTile: SameLetterTile = {
        type: 'sameLetter',
        constraint: { nextRow: 1 },
      };

      const grid = createTestGrid([
        [createTestCell('A', true, ruleTile), createTestCell('B', true)],
        [createTestCell('X', true), createTestCell('Y', true)],
      ]);

      expect(validateSameLetterTiles(grid, 1)).toBe(false);
    });

    it('should handle multiple SameLetterTiles pointing to same target row', () => {
      const ruleTile1: SameLetterTile = {
        type: 'sameLetter',
        constraint: { nextRow: 2 },
      };
      const ruleTile2: SameLetterTile = {
        type: 'sameLetter',
        constraint: { nextRow: 2 },
      };

      const grid = createTestGrid([
        [createTestCell('A', true, ruleTile1), createTestCell('B', true)],
        [createTestCell('C', true, ruleTile2), createTestCell('D', true)],
        [createTestCell('A', true), createTestCell('C', true)],
      ]);

      expect(validateSameLetterTiles(grid, 2)).toBe(true);
    });

    it('should return false when one of multiple required letters is missing', () => {
      const ruleTile1: SameLetterTile = {
        type: 'sameLetter',
        constraint: { nextRow: 2 },
      };
      const ruleTile2: SameLetterTile = {
        type: 'sameLetter',
        constraint: { nextRow: 2 },
      };

      const grid = createTestGrid([
        [createTestCell('A', true, ruleTile1), createTestCell('B', true)],
        [createTestCell('C', true, ruleTile2), createTestCell('D', true)],
        [createTestCell('A', true), createTestCell('X', true)], // Missing 'C'
      ]);

      expect(validateSameLetterTiles(grid, 2)).toBe(false);
    });

    it('should handle letter appearing multiple times in target row', () => {
      const ruleTile: SameLetterTile = {
        type: 'sameLetter',
        constraint: { nextRow: 1 },
      };

      const grid = createTestGrid([
        [createTestCell('A', true, ruleTile), createTestCell('B', true)],
        [createTestCell('A', true), createTestCell('A', true)],
      ]);

      expect(validateSameLetterTiles(grid, 1)).toBe(true);
    });

    it('should ignore inaccessible cells in target row', () => {
      const ruleTile: SameLetterTile = {
        type: 'sameLetter',
        constraint: { nextRow: 1 },
      };

      const grid = createTestGrid([
        [createTestCell('A', true, ruleTile), createTestCell('B', true)],
        [createTestCell('A', false), createTestCell('X', true)],
      ]);

      expect(validateSameLetterTiles(grid, 1)).toBe(false);
    });

    it('should return false when source cell has no letter', () => {
      const ruleTile: SameLetterTile = {
        type: 'sameLetter',
        constraint: { nextRow: 1 },
      };

      const grid = createTestGrid([
        [createTestCell(null, true, ruleTile), createTestCell('B', true)],
        [createTestCell('X', true), createTestCell('Y', true)],
      ]);

      expect(validateSameLetterTiles(grid, 1)).toBe(false);
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
    it('should handle grid with both SameLetterPosition and SameLetter tiles', () => {
      const positionTileTop: SameLetterPositionTile = {
        type: 'sameLetterPosition',
        constraint: { pairedRow: 1, pairedCol: 0, position: 'top' },
      };
      const positionTileBottom: SameLetterPositionTile = {
        type: 'sameLetterPosition',
        constraint: { pairedRow: 0, pairedCol: 0, position: 'bottom' },
      };
      const letterTile: SameLetterTile = {
        type: 'sameLetter',
        constraint: { nextRow: 2 },
      };

      const grid = createTestGrid([
        [createTestCell('A', true, positionTileTop), createTestCell('B', true)],
        [createTestCell('A', true, positionTileBottom), createTestCell('C', true, letterTile)],
        [createTestCell('X', true), createTestCell('C', true)],
      ]);

      expect(validateSameLetterPositionTiles(grid, 0)).toBe(true);
      expect(validateSameLetterPositionTiles(grid, 1)).toBe(true);
      expect(validateSameLetterTiles(grid, 2)).toBe(true);
    });

    it('should fail when SameLetterPosition fails but SameLetter passes', () => {
      const positionTileTop: SameLetterPositionTile = {
        type: 'sameLetterPosition',
        constraint: { pairedRow: 1, pairedCol: 0, position: 'top' },
      };
      const positionTileBottom: SameLetterPositionTile = {
        type: 'sameLetterPosition',
        constraint: { pairedRow: 0, pairedCol: 0, position: 'bottom' },
      };
      const letterTile: SameLetterTile = {
        type: 'sameLetter',
        constraint: { nextRow: 2 },
      };

      const grid = createTestGrid([
        [createTestCell('A', true, positionTileTop), createTestCell('B', true)],
        [createTestCell('X', true, positionTileBottom), createTestCell('C', true, letterTile)],
        [createTestCell('Y', true), createTestCell('C', true)],
      ]);

      expect(validateSameLetterPositionTiles(grid, 0)).toBe(false);
      expect(validateSameLetterTiles(grid, 2)).toBe(true);
    });

    it('should handle complex multi-row scenario', () => {
      const pos1Top: SameLetterPositionTile = {
        type: 'sameLetterPosition',
        constraint: { pairedRow: 1, pairedCol: 1, position: 'top' },
      };
      const pos1Bottom: SameLetterPositionTile = {
        type: 'sameLetterPosition',
        constraint: { pairedRow: 0, pairedCol: 1, position: 'bottom' },
      };
      const letter1: SameLetterTile = {
        type: 'sameLetter',
        constraint: { nextRow: 1 },
      };
      const letter2: SameLetterTile = {
        type: 'sameLetter',
        constraint: { nextRow: 2 },
      };

      const grid = createTestGrid([
        [createTestCell('A', true, letter1), createTestCell('B', true, pos1Top), createTestCell('C', true)],
        [createTestCell('X', true), createTestCell('B', true, pos1Bottom), createTestCell('A', true, letter2)],
        [createTestCell('Y', true), createTestCell('Z', true), createTestCell('A', true)],
      ]);

      expect(validateSameLetterPositionTiles(grid, 0)).toBe(true);
      expect(validateSameLetterPositionTiles(grid, 1)).toBe(true);
      expect(validateSameLetterTiles(grid, 1)).toBe(true);
      expect(validateSameLetterTiles(grid, 2)).toBe(true);
    });
  });

  describe('getRowValidationState', () => {
    it('should return all true for simple valid row', () => {
      const grid = createTestGrid([
        [createTestCell('C', true), createTestCell('A', true), createTestCell('T', true)],
      ]);

      const state = getRowValidationState(grid, 0);
      expect(state.spelling).toBe(true);
      expect(state.sameLetterPosition).toBe(true);
      expect(state.sameLetter).toBe(true);
      expect(state.uniqueWords).toBe(true);
      expect(state.hasSameLetterPositionTile).toBe(false);
      expect(state.hasSameLetterTile).toBe(false);
    });

    it('should detect SameLetterPositionTile presence', () => {
      const positionTile: SameLetterPositionTile = {
        type: 'sameLetterPosition',
        constraint: { pairedRow: 1, pairedCol: 0, position: 'top' },
      };

      const grid = createTestGrid([
        [createTestCell('A', true, positionTile), createTestCell('B', true)],
        [createTestCell('A', true), createTestCell('C', true)],
      ]);

      const state = getRowValidationState(grid, 0);
      expect(state.hasSameLetterPositionTile).toBe(true);
    });

    it('should detect SameLetterTile as target row', () => {
      const letterTile: SameLetterTile = {
        type: 'sameLetter',
        constraint: { nextRow: 1 },
      };

      const grid = createTestGrid([
        [createTestCell('A', true, letterTile), createTestCell('B', true)],
        [createTestCell('A', true), createTestCell('C', true)],
      ]);

      const state0 = getRowValidationState(grid, 0);
      expect(state0.hasSameLetterTile).toBe(false);

      const state1 = getRowValidationState(grid, 1);
      expect(state1.hasSameLetterTile).toBe(true);
    });

    it('should return validation status for all rules', () => {
      const positionTileTop: SameLetterPositionTile = {
        type: 'sameLetterPosition',
        constraint: { pairedRow: 1, pairedCol: 0, position: 'top' },
      };
      const positionTileBottom: SameLetterPositionTile = {
        type: 'sameLetterPosition',
        constraint: { pairedRow: 0, pairedCol: 0, position: 'bottom' },
      };

      const grid = createTestGrid([
        [createTestCell('A', true, positionTileTop), createTestCell('B', true)],
        [createTestCell('X', true, positionTileBottom), createTestCell('C', true)],
      ]);

      const state = getRowValidationState(grid, 0);
      expect(state.spelling).toBe(true);
      expect(state.sameLetterPosition).toBe(false);
      expect(state.sameLetter).toBe(true);
      expect(state.uniqueWords).toBe(true);
      expect(state.hasSameLetterPositionTile).toBe(true);
      expect(state.hasSameLetterTile).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty grid', () => {
      const grid = createTestGrid([[]]);
      expect(validateSpelling(grid, 0)).toBe(true);
      expect(validateSameLetterPositionTiles(grid, 0)).toBe(true);
      expect(validateSameLetterTiles(grid, 0)).toBe(true);
    });

    it('should handle single cell grid', () => {
      const grid = createTestGrid([[createTestCell('A', true)]]);
      expect(validateSpelling(grid, 0)).toBe(true);
      expect(validateSameLetterPositionTiles(grid, 0)).toBe(true);
      expect(validateSameLetterTiles(grid, 0)).toBe(true);
    });

    it('should handle all inaccessible cells', () => {
      const grid = createTestGrid([
        [createTestCell('A', false), createTestCell('B', false)],
      ]);
      expect(validateSpelling(grid, 0)).toBe(true);
      expect(validateSameLetterPositionTiles(grid, 0)).toBe(true);
      expect(validateSameLetterTiles(grid, 0)).toBe(true);
    });

    it('should handle row with no letters filled', () => {
      const grid = createTestGrid([
        [createTestCell(null, true), createTestCell(null, true)],
      ]);
      expect(validateSpelling(grid, 0)).toBe(true);
      expect(validateSameLetterPositionTiles(grid, 0)).toBe(true);
      expect(validateSameLetterTiles(grid, 0)).toBe(true);
    });

    it('should handle case sensitivity', () => {
      const topTile: SameLetterPositionTile = {
        type: 'sameLetterPosition',
        constraint: { pairedRow: 1, pairedCol: 0, position: 'top' },
      };
      const bottomTile: SameLetterPositionTile = {
        type: 'sameLetterPosition',
        constraint: { pairedRow: 0, pairedCol: 0, position: 'bottom' },
      };

      const grid = createTestGrid([
        [createTestCell('A', true, topTile), createTestCell('B', true)],
        [createTestCell('A', true, bottomTile), createTestCell('C', true)],
      ]);

      expect(validateSameLetterPositionTiles(grid, 0)).toBe(true);
    });
  });
});

