import { getValidNextWords, countValidNextWords } from './HintEngine';
import { Grid, Cell, HardMatchTile, SoftMatchTile, ForbiddenMatchTile, RuleTile } from './types';
import { generatorDictionary } from './Dictionary';

function createCell(
  letter: string | null = null,
  accessible: boolean = true,
  ruleTile?: RuleTile,
): Cell {
  return { letter, accessible, ruleTile, state: 'empty', validation: 'none' };
}

function createGrid(cells: Cell[][]): Grid {
  return { rows: cells.length, cols: cells[0]?.length ?? 0, cells };
}

describe('HintEngine', () => {
  beforeAll(() => {
    generatorDictionary.initialize();
  });

  describe('getValidNextWords', () => {
    it('returns results when a hardMatch constraint is active', () => {
      const hardMatch: HardMatchTile = {
        type: 'hardMatch',
        constraint: { pairedRow: 0, pairedCol: 0, position: 'bottom' },
      };

      // Row 0 complete with 'A' at col 0; row 1 target must also start with 'A'
      const grid = createGrid([
        [createCell('A'), createCell('N'), createCell('T'), createCell('S')],
        [createCell(null, true, hardMatch), createCell(null), createCell(null), createCell(null)],
      ]);

      const result = getValidNextWords(grid, 1, 50);
      expect(result.count).toBeGreaterThan(0);
      expect(result.examples.every(w => w.startsWith('a'))).toBe(true);
    });

    it('returns no results when there are no active constraints', () => {
      const grid = createGrid([
        [createCell('A'), createCell('N'), createCell('T'), createCell('S')],
        [createCell(null), createCell(null), createCell(null), createCell(null)],
      ]);
      // No completed row contributes constraints, so hint engine stays silent
      const result = getValidNextWords(grid, 1, 50);
      expect(result.count).toBe(0);
    });

    describe('forbiddenMatch deadlock detection', () => {
      it('excludes words that would place a next-row-required letter on a forbiddenMatch tile — required letter comes from a completed row', () => {
        // Row 0 complete: 'A' at col 0.
        // Row 1 (target):
        //   col 0: hardMatch → row0,col0  → must be 'A'
        //   col 2: forbiddenMatch → row2   → whatever lands here is banned from row 2
        // Row 2:
        //   col 0: hardMatch → row0,col0  → must be 'A'
        //
        // AWAY = A·W·A·Y puts 'A' at col 2 (forbiddenMatch), banning 'A' from row 2.
        // But row 2 requires 'A' via its own hardMatch → AWAY is a dead end.

        const hardMatchRow1: HardMatchTile = {
          type: 'hardMatch',
          constraint: { pairedRow: 0, pairedCol: 0, position: 'bottom' },
        };
        const forbiddenToRow2: ForbiddenMatchTile = {
          type: 'forbiddenMatch',
          constraint: { nextRow: 2 },
        };
        const hardMatchRow2: HardMatchTile = {
          type: 'hardMatch',
          constraint: { pairedRow: 0, pairedCol: 0, position: 'bottom' },
        };

        const grid = createGrid([
          [createCell('A'), createCell('N'), createCell('T'), createCell('S')],
          [createCell(null, true, hardMatchRow1), createCell(null), createCell(null, true, forbiddenToRow2), createCell(null)],
          [createCell(null, true, hardMatchRow2), createCell(null), createCell(null), createCell(null)],
        ]);

        const result = getValidNextWords(grid, 1, 1000);

        expect(result.count).toBeGreaterThan(0);
        // 'away' has 'A' at position 2 — banned because row 2 needs 'A'
        expect(result.examples).not.toContain('away');
        // 'also' has 'S' at position 2 — no conflict with row 2's 'A' requirement
        expect(result.examples).toContain('also');
      });

      it('excludes words that would place a next-row-required letter on a forbiddenMatch tile — required letter inferred from the target row\'s own hardMatch constraint', () => {
        // Same structure but row 2's hardMatch is paired with row 1 (the target row),
        // not with the completed row 0. At hint time row 1 has no letters, but the
        // engine knows col 0 will be 'A' via hardMatchConstraints → still filters correctly.

        const hardMatchRow1: HardMatchTile = {
          type: 'hardMatch',
          constraint: { pairedRow: 0, pairedCol: 0, position: 'bottom' },
        };
        const forbiddenToRow2: ForbiddenMatchTile = {
          type: 'forbiddenMatch',
          constraint: { nextRow: 2 },
        };
        const hardMatchRow2PairedWithTarget: HardMatchTile = {
          type: 'hardMatch',
          // paired with row 1 col 0 (the target row, which will be 'A')
          constraint: { pairedRow: 1, pairedCol: 0, position: 'bottom' },
        };

        const grid = createGrid([
          [createCell('A'), createCell('N'), createCell('T'), createCell('S')],
          [createCell(null, true, hardMatchRow1), createCell(null), createCell(null, true, forbiddenToRow2), createCell(null)],
          [createCell(null, true, hardMatchRow2PairedWithTarget), createCell(null), createCell(null), createCell(null)],
        ]);

        const result = getValidNextWords(grid, 1, 1000);

        expect(result.count).toBeGreaterThan(0);
        expect(result.examples).not.toContain('away');
      });

      it('excludes letters that appear anywhere in a complete bottom row even when cells are not marked fixed', () => {
        const hardMatchRow1: HardMatchTile = {
          type: 'hardMatch',
          constraint: { pairedRow: 0, pairedCol: 0, position: 'bottom' },
        };
        const forbiddenToRow2: ForbiddenMatchTile = {
          type: 'forbiddenMatch',
          constraint: { nextRow: 2 },
        };

        const grid = createGrid([
          [createCell('A'), createCell('N'), createCell('T'), createCell('S')],
          [createCell(null, true, hardMatchRow1), createCell(null), createCell(null, true, forbiddenToRow2), createCell(null)],
          [createCell('A'), createCell('N'), createCell('T'), createCell('S')],
        ]);

        const result = getValidNextWords(grid, 1, 1000);
        expect(result.count).toBeGreaterThan(0);
        const bannedAtForbiddenPos = new Set(['a', 'n', 't', 's']);
        for (const w of result.examples) {
          expect(bannedAtForbiddenPos.has(w[2])).toBe(false);
        }
        expect(result.examples).not.toContain('away');
      });

      it('does NOT filter words when the forbiddenMatch letter does not conflict with the next row', () => {
        // Row 2 has no constraints, so nothing is required there.
        // ALSO should be a valid suggestion (it starts with 'A' as required).

        const hardMatchRow1: HardMatchTile = {
          type: 'hardMatch',
          constraint: { pairedRow: 0, pairedCol: 0, position: 'bottom' },
        };
        const forbiddenToRow2: ForbiddenMatchTile = {
          type: 'forbiddenMatch',
          constraint: { nextRow: 2 },
        };

        const grid = createGrid([
          [createCell('A'), createCell('N'), createCell('T'), createCell('S')],
          [createCell(null, true, hardMatchRow1), createCell(null), createCell(null, true, forbiddenToRow2), createCell(null)],
          [createCell(null), createCell(null), createCell(null), createCell(null)],
        ]);

        const result = getValidNextWords(grid, 1, 1000);
        expect(result.examples).toContain('also');
      });
    });

    describe('softMatch forward-look', () => {
      function fixedCell(letter: string, ruleTile?: RuleTile): Cell {
        return { letter, accessible: true, fixed: true, state: 'locked', validation: 'correct', ruleTile };
      }

      it('excludes words where a softMatch position letter is absent from the fixed next row', () => {
        // Row 0 complete: "ANTS"
        // Row 1 (target):
        //   col 0: softMatch → row2  → letter placed here must appear in row 2
        //   cols 1-2: plain empty
        // Row 2: fixed "ROT"
        //
        // DUO puts 'D' at col 0 (softMatch), but ROT doesn't contain 'D' → reject.
        // RUG puts 'R' at col 0 (softMatch), ROT contains 'R' → accept.

        const hardMatchRow1: HardMatchTile = {
          type: 'hardMatch',
          constraint: { pairedRow: 0, pairedCol: 0, position: 'bottom' },
        };
        const softToRow2: SoftMatchTile = {
          type: 'softMatch',
          constraint: { nextRow: 2 },
        };

        const grid = createGrid([
          [createCell('A'), createCell('N'), createCell('T'), createCell('S')],
          [createCell(null, true, softToRow2), createCell(null, true, hardMatchRow1), createCell(null), createCell(null)],
          [createCell(null, false), fixedCell('R'), fixedCell('O'), fixedCell('T')],
        ]);

        const result = getValidNextWords(grid, 1, 1000);
        expect(result.count).toBeGreaterThan(0);
        expect(result.examples).not.toContain('duo');
        // Words starting with R, O, or T at the softMatch position are fine
        expect(result.examples.every(w => 'rot'.includes(w[0]))).toBe(true);
      });

      it('returns hints when softMatch→fixed row is the only active constraint (no upstream completed row)', () => {
        const softToRow2: SoftMatchTile = {
          type: 'softMatch',
          constraint: { nextRow: 2 },
        };

        const grid = createGrid([
          [createCell(null), createCell(null), createCell(null), createCell(null)],
          [createCell(null, true, softToRow2), createCell(null), createCell(null), createCell(null)],
          [createCell(null, false), fixedCell('R'), fixedCell('O'), fixedCell('T')],
        ]);

        const result = getValidNextWords(grid, 1, 1000);
        expect(result.count).toBeGreaterThan(0);
        expect(result.examples.every(w => 'rot'.includes(w[0]))).toBe(true);
      });

      it('does not filter when the next row is incomplete', () => {
        const hardMatchRow1: HardMatchTile = {
          type: 'hardMatch',
          constraint: { pairedRow: 0, pairedCol: 0, position: 'bottom' },
        };
        const softToRow2: SoftMatchTile = {
          type: 'softMatch',
          constraint: { nextRow: 2 },
        };

        const grid = createGrid([
          [createCell('A'), createCell('N'), createCell('T'), createCell('S')],
          [createCell(null, true, softToRow2), createCell(null, true, hardMatchRow1), createCell(null), createCell(null)],
          [createCell(null), createCell(null), createCell(null), createCell(null)],
        ]);

        const result = getValidNextWords(grid, 1, 1000);
        // Not restricted to R/O/T — any letter is allowed at pos 0
        const firstLetters = new Set(result.examples.map(w => w[0]));
        expect(firstLetters.size).toBeGreaterThan(3);
      });

      it('allows all letters present in the fixed next row', () => {
        const hardMatchRow1: HardMatchTile = {
          type: 'hardMatch',
          constraint: { pairedRow: 0, pairedCol: 0, position: 'bottom' },
        };
        const softToRow2: SoftMatchTile = {
          type: 'softMatch',
          constraint: { nextRow: 2 },
        };

        const grid = createGrid([
          [createCell('S'), createCell('T'), createCell('A'), createCell('R')],
          [createCell(null, true, softToRow2), createCell(null, true, hardMatchRow1), createCell(null), createCell(null)],
          [createCell(null, false), fixedCell('S'), fixedCell('A'), fixedCell('T')],
        ]);

        const result = getValidNextWords(grid, 1, 1000);
        // Every word's first letter must be one of S, A, T
        for (const word of result.examples) {
          expect('sat'.includes(word[0])).toBe(true);
        }
      });
    });
  });

  describe('countValidNextWords', () => {
    it('returns 0 when there are no active constraints', () => {
      const grid = createGrid([
        [createCell(null), createCell(null), createCell(null), createCell(null)],
      ]);
      expect(countValidNextWords(grid, 0)).toBe(0);
    });

    it('returns fewer results when a deadlock-causing word is filtered out', () => {
      const hardMatchRow1: HardMatchTile = {
        type: 'hardMatch',
        constraint: { pairedRow: 0, pairedCol: 0, position: 'bottom' },
      };
      const forbiddenToRow2: ForbiddenMatchTile = {
        type: 'forbiddenMatch',
        constraint: { nextRow: 2 },
      };
      const hardMatchRow2: HardMatchTile = {
        type: 'hardMatch',
        constraint: { pairedRow: 0, pairedCol: 0, position: 'bottom' },
      };

      const gridWithDeadlockRisk = createGrid([
        [createCell('A'), createCell('N'), createCell('T'), createCell('S')],
        [createCell(null, true, hardMatchRow1), createCell(null), createCell(null, true, forbiddenToRow2), createCell(null)],
        [createCell(null, true, hardMatchRow2), createCell(null), createCell(null), createCell(null)],
      ]);

      // Without next-row hardMatch constraint: no downstream deadlock filtering
      const gridWithoutDeadlockRisk = createGrid([
        [createCell('A'), createCell('N'), createCell('T'), createCell('S')],
        [createCell(null, true, hardMatchRow1), createCell(null), createCell(null, true, forbiddenToRow2), createCell(null)],
        [createCell(null), createCell(null), createCell(null), createCell(null)],
      ]);

      const countWithRisk = countValidNextWords(gridWithDeadlockRisk, 1);
      const countWithoutRisk = countValidNextWords(gridWithoutDeadlockRisk, 1);

      expect(countWithRisk).toBeLessThan(countWithoutRisk);
    });
  });
});
