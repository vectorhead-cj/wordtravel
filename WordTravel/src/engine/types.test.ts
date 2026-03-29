import {
  softForbiddenUnidirectionalRotation,
  lastWordSlotRow,
  type ForbiddenMatchTile,
  type PuzzleConfig,
  type SoftMatchTile,
} from './types';

describe('lastWordSlotRow', () => {
  it('returns the last word slot row index', () => {
    const config: PuzzleConfig = {
      wordSlots: [
        { row: 1, length: 4, startCol: 0, endCol: 3 },
        { row: 3, length: 5, startCol: 0, endCol: 4 },
      ],
      rows: 5,
      cols: 5,
    };
    expect(lastWordSlotRow(config)).toBe(3);
  });
});

describe('softForbiddenUnidirectionalRotation', () => {
  it('returns 180 when the tile only constrains the previous row (upward semantics)', () => {
    const soft: SoftMatchTile = { type: 'softMatch', constraint: { prevRow: 2 } };
    const forb: ForbiddenMatchTile = { type: 'forbiddenMatch', constraint: { prevRow: 2 } };
    expect(softForbiddenUnidirectionalRotation(soft)).toBe(180);
    expect(softForbiddenUnidirectionalRotation(forb)).toBe(180);
  });

  it('returns 0 when the tile only constrains the next row (downward semantics)', () => {
    const soft: SoftMatchTile = { type: 'softMatch', constraint: { nextRow: 4 } };
    const forb: ForbiddenMatchTile = { type: 'forbiddenMatch', constraint: { nextRow: 4 } };
    expect(softForbiddenUnidirectionalRotation(soft)).toBe(0);
    expect(softForbiddenUnidirectionalRotation(forb)).toBe(0);
  });

  it('returns undefined for bidirectional tiles (CellView renders both directions)', () => {
    const soft: SoftMatchTile = {
      type: 'softMatch',
      constraint: { nextRow: 3, prevRow: 1 },
    };
    expect(softForbiddenUnidirectionalRotation(soft)).toBeUndefined();
  });
});
