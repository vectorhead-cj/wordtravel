import { Grid, Cell, GameMode } from './types';

export function createMockGrid(mode: GameMode): Grid {
  const wordRows = mode === 'puzzle' ? 5 : 15;
  const rows = wordRows + 2;
  const cols = 7;
  const cells: Cell[][] = [];

  for (let row = 0; row < rows; row++) {
    cells[row] = [];
    for (let col = 0; col < cols; col++) {
      const isWordRow = row >= 1 && row <= wordRows;
      const isWordCell = isWordRow && col >= 1 && col <= 5;
      
      cells[row][col] = {
        letter: null,
        state: 'empty',
        accessible: isWordCell,
      };
    }
  }

  return {
    rows,
    cols,
    cells,
  };
}

