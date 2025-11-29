import { Grid, Cell, GameMode } from './types';

export function createMockGrid(
  mode: GameMode, 
  paddingRowsTop: number = 1, 
  paddingRowsBottom: number = 1
): Grid {
  const wordRows = mode === 'puzzle' ? 5 : 15;
  const rows = wordRows + paddingRowsTop + paddingRowsBottom;
  const cols = 9;
  const cells: Cell[][] = [];

  for (let row = 0; row < rows; row++) {
    cells[row] = [];
    for (let col = 0; col < cols; col++) {
      const isWordRow = row >= paddingRowsTop && row < paddingRowsTop + wordRows;
      const isWordCell = isWordRow && col >= 2 && col <= 6;
      
      cells[row][col] = {
        letter: null,
        state: 'empty',
        accessible: isWordCell,
        validation: 'none',
      };
    }
  }

  return {
    rows,
    cols,
    cells,
  };
}

