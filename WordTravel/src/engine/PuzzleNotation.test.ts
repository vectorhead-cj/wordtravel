import { parseGrid, serializeGrid, addPadding } from './PuzzleNotation';

describe('PuzzleNotation', () => {
  describe('parseGrid', () => {
    it('should parse all-space input as non-accessible cells', () => {
      const grid = parseGrid('   \n   ');
      expect(grid.rows).toBe(2);
      expect(grid.cols).toBe(3);
      for (let r = 0; r < grid.rows; r++) {
        for (let c = 0; c < grid.cols; c++) {
          expect(grid.cells[r][c].accessible).toBe(false);
        }
      }
    });

    it('should parse dots as accessible empty cells', () => {
      const grid = parseGrid('...\n...');
      expect(grid.rows).toBe(2);
      expect(grid.cols).toBe(3);
      for (let r = 0; r < grid.rows; r++) {
        for (let c = 0; c < grid.cols; c++) {
          const cell = grid.cells[r][c];
          expect(cell.accessible).toBe(true);
          expect(cell.letter).toBeNull();
          expect(cell.state).toBe('empty');
          expect(cell.ruleTile).toBeUndefined();
        }
      }
    });

    it('should parse fixed letters', () => {
      const grid = parseGrid('CAT');
      expect(grid.cols).toBe(3);
      expect(grid.cells[0][0].letter).toBe('C');
      expect(grid.cells[0][1].letter).toBe('A');
      expect(grid.cells[0][2].letter).toBe('T');
      for (let c = 0; c < 3; c++) {
        expect(grid.cells[0][c].fixed).toBe(true);
        expect(grid.cells[0][c].state).toBe('locked');
        expect(grid.cells[0][c].validation).toBe('correct');
        expect(grid.cells[0][c].accessible).toBe(true);
      }
    });

    it('should parse ^ as hard match top tile', () => {
      const grid = parseGrid('^\n.');
      const cell = grid.cells[0][0];
      expect(cell.accessible).toBe(true);
      expect(cell.letter).toBeNull();
      expect(cell.ruleTile?.type).toBe('hardMatch');
      if (cell.ruleTile?.type === 'hardMatch') {
        expect(cell.ruleTile.constraint.position).toBe('top');
        expect(cell.ruleTile.constraint.pairedRow).toBe(1);
        expect(cell.ruleTile.constraint.pairedCol).toBe(0);
      }
    });

    it('should parse ~ as soft match tile', () => {
      const grid = parseGrid('~\n.');
      const cell = grid.cells[0][0];
      expect(cell.accessible).toBe(true);
      expect(cell.letter).toBeNull();
      expect(cell.ruleTile?.type).toBe('softMatch');
      if (cell.ruleTile?.type === 'softMatch') {
        expect(cell.ruleTile.constraint.nextRow).toBe(1);
      }
    });

    it('should parse ¨ as forbidden match tile', () => {
      const grid = parseGrid('¨\n.');
      const cell = grid.cells[0][0];
      expect(cell.accessible).toBe(true);
      expect(cell.letter).toBeNull();
      expect(cell.ruleTile?.type).toBe('forbiddenMatch');
      if (cell.ruleTile?.type === 'forbiddenMatch') {
        expect(cell.ruleTile.constraint.nextRow).toBe(1);
      }
    });

    it('should parse letter + circumflex as fixed letter with hard match', () => {
      const grid = parseGrid('\u00C2\n.');  // Â
      const cell = grid.cells[0][0];
      expect(cell.letter).toBe('A');
      expect(cell.fixed).toBe(true);
      expect(cell.ruleTile?.type).toBe('hardMatch');
    });

    it('should parse letter + tilde as fixed letter with soft match', () => {
      const grid = parseGrid('\u00C3\n.');  // Ã
      const cell = grid.cells[0][0];
      expect(cell.letter).toBe('A');
      expect(cell.fixed).toBe(true);
      expect(cell.ruleTile?.type).toBe('softMatch');
    });

    it('should parse letter + diaeresis as fixed letter with forbidden match', () => {
      const grid = parseGrid('\u00DC\n.');  // Ü
      const cell = grid.cells[0][0];
      expect(cell.letter).toBe('U');
      expect(cell.fixed).toBe(true);
      expect(cell.ruleTile?.type).toBe('forbiddenMatch');
    });

    it('should auto-create hard match bottom partner', () => {
      const grid = parseGrid('^\n.');
      const top = grid.cells[0][0];
      const bottom = grid.cells[1][0];

      expect(top.ruleTile?.type).toBe('hardMatch');
      expect(bottom.ruleTile?.type).toBe('hardMatch');
      if (bottom.ruleTile?.type === 'hardMatch') {
        expect(bottom.ruleTile.constraint.position).toBe('bottom');
        expect(bottom.ruleTile.constraint.pairedRow).toBe(0);
        expect(bottom.ruleTile.constraint.pairedCol).toBe(0);
      }
    });

    it('should not overwrite existing rule tile when auto-creating bottom partner', () => {
      const grid = parseGrid('^\n~\n.');
      const bottom = grid.cells[1][0];
      // Row 1 already has ~ (soft match), should not be overwritten
      expect(bottom.ruleTile?.type).toBe('softMatch');
    });

    it('should parse mixed row correctly', () => {
      const grid = parseGrid(' ^.A~\n .....');
      expect(grid.cols).toBe(6);

      expect(grid.cells[0][0].accessible).toBe(false);
      expect(grid.cells[0][1].ruleTile?.type).toBe('hardMatch');
      expect(grid.cells[0][2].accessible).toBe(true);
      expect(grid.cells[0][2].ruleTile).toBeUndefined();
      expect(grid.cells[0][3].letter).toBe('A');
      expect(grid.cells[0][3].fixed).toBe(true);
      expect(grid.cells[0][4].ruleTile?.type).toBe('softMatch');
    });

    it('should infer grid width from longest line', () => {
      const grid = parseGrid('...\n.....\n..');
      expect(grid.cols).toBe(5);
      // Short lines are right-padded with non-accessible
      expect(grid.cells[0][3].accessible).toBe(false);
      expect(grid.cells[0][4].accessible).toBe(false);
      expect(grid.cells[2][2].accessible).toBe(false);
    });

    it('should handle a full bridge puzzle layout', () => {
      const notation = [
        ' CAT',
        ' ~..',
        '..^..',
        '.¨...',
        '.....',
        ' ..~',
        ' ...',
        ' DOG',
      ].join('\n');
      const grid = parseGrid(notation);

      expect(grid.rows).toBe(8);
      // First row: fixed CAT
      expect(grid.cells[0][1].letter).toBe('C');
      expect(grid.cells[0][1].fixed).toBe(true);
      // Last row: fixed DOG
      expect(grid.cells[7][1].letter).toBe('D');
      expect(grid.cells[7][2].letter).toBe('O');
      expect(grid.cells[7][3].letter).toBe('G');
      // Soft match at row 1 col 1
      expect(grid.cells[1][1].ruleTile?.type).toBe('softMatch');
      // Hard match pair at row 2 col 2
      expect(grid.cells[2][2].ruleTile?.type).toBe('hardMatch');
      if (grid.cells[2][2].ruleTile?.type === 'hardMatch') {
        expect(grid.cells[2][2].ruleTile.constraint.position).toBe('top');
      }
      expect(grid.cells[3][2].ruleTile?.type).toBe('hardMatch');
      // Forbidden match at row 3 col 1
      expect(grid.cells[3][1].ruleTile?.type).toBe('forbiddenMatch');
    });
  });

  describe('serializeGrid', () => {
    it('should round-trip simple dots', () => {
      const input = '...\n...';
      expect(serializeGrid(parseGrid(input))).toBe(input);
    });

    it('should round-trip fixed letters', () => {
      const input = 'CAT';
      expect(serializeGrid(parseGrid(input))).toBe(input);
    });

    it('should round-trip rule tiles with uniform width', () => {
      const input = '^.~.\n....\n.¨..';
      expect(serializeGrid(parseGrid(input))).toBe(input);
    });

    it('should round-trip letter+rule combos with uniform width', () => {
      const input = '\u00C2\u00C3\u00DC\n...';  // ÂÃÜ — both lines are 3 chars
      expect(serializeGrid(parseGrid(input))).toBe(input);
    });

    it('should omit hard match bottom tiles in output', () => {
      const grid = parseGrid('^\n.');
      const serialized = serializeGrid(grid);
      // Row 1 has auto-created bottom tile, but serializes as plain '.'
      expect(serialized).toBe('^\n.');
    });

    it('should preserve trailing spaces to maintain grid width', () => {
      const grid = parseGrid('.  \n.  ');
      const serialized = serializeGrid(grid);
      expect(serialized).toBe('.  \n.  ');
    });

    it('should round-trip mixed layout with spaces', () => {
      const input = ' ^. \n....\n .~ ';
      expect(serializeGrid(parseGrid(input))).toBe(input);
    });

    it('should round-trip bridge puzzle', () => {
      const input = [
        ' CAT ',
        ' ~.. ',
        '..^..',
        '.¨...',
        '.....',
        ' ..~ ',
        ' ... ',
        ' DOG ',
      ].join('\n');
      expect(serializeGrid(parseGrid(input))).toBe(input);
    });
  });

  describe('addPadding', () => {
    it('should add non-accessible rows at top and bottom', () => {
      const grid = parseGrid('...');
      const padded = addPadding(grid, 2, 3);

      expect(padded.rows).toBe(6); // 1 + 2 + 3
      expect(padded.cols).toBe(3);

      // Top padding rows
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 3; c++) {
          expect(padded.cells[r][c].accessible).toBe(false);
        }
      }
      // Original row shifted to index 2
      for (let c = 0; c < 3; c++) {
        expect(padded.cells[2][c].accessible).toBe(true);
      }
      // Bottom padding rows
      for (let r = 3; r < 6; r++) {
        for (let c = 0; c < 3; c++) {
          expect(padded.cells[r][c].accessible).toBe(false);
        }
      }
    });

    it('should shift hard match row references by top padding', () => {
      const grid = parseGrid('^\n.');
      const padded = addPadding(grid, 3, 0);

      // Original row 0 -> padded row 3
      const topCell = padded.cells[3][0];
      expect(topCell.ruleTile?.type).toBe('hardMatch');
      if (topCell.ruleTile?.type === 'hardMatch') {
        expect(topCell.ruleTile.constraint.pairedRow).toBe(4); // was 1, shifted by 3
        expect(topCell.ruleTile.constraint.position).toBe('top');
      }

      // Original row 1 -> padded row 4
      const bottomCell = padded.cells[4][0];
      expect(bottomCell.ruleTile?.type).toBe('hardMatch');
      if (bottomCell.ruleTile?.type === 'hardMatch') {
        expect(bottomCell.ruleTile.constraint.pairedRow).toBe(3); // was 0, shifted by 3
        expect(bottomCell.ruleTile.constraint.position).toBe('bottom');
      }
    });

    it('should shift soft match row references by top padding', () => {
      const grid = parseGrid('~\n.');
      const padded = addPadding(grid, 5, 0);

      const cell = padded.cells[5][0];
      expect(cell.ruleTile?.type).toBe('softMatch');
      if (cell.ruleTile?.type === 'softMatch') {
        expect(cell.ruleTile.constraint.nextRow).toBe(6); // was 1, shifted by 5
      }
    });

    it('should shift forbidden match row references by top padding', () => {
      const grid = parseGrid('¨\n.');
      const padded = addPadding(grid, 2, 0);

      const cell = padded.cells[2][0];
      expect(cell.ruleTile?.type).toBe('forbiddenMatch');
      if (cell.ruleTile?.type === 'forbiddenMatch') {
        expect(cell.ruleTile.constraint.nextRow).toBe(3); // was 1, shifted by 2
      }
    });

    it('should handle zero padding', () => {
      const grid = parseGrid('...');
      const padded = addPadding(grid, 0, 0);
      expect(padded.rows).toBe(1);
      expect(padded.cols).toBe(3);
    });
  });
});
