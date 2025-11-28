import { Grid, GameMode, SameLetterPositionTile } from './types';
import { dictionary } from './Dictionary';

const DICTIONARY_CHECK_ENABLED = false;

export function findFirstAccessibleCell(grid: Grid): { row: number; col: number } {
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      if (grid.cells[row][col].accessible) {
        return { row, col };
      }
    }
  }
  return { row: 0, col: 0 };
}

export function getWordFromRow(grid: Grid, row: number): string {
  let word = '';
  for (let col = 0; col < grid.cols; col++) {
    const cell = grid.cells[row][col];
    if (cell.accessible && cell.letter) {
      word += cell.letter;
    }
  }
  return word;
}

export function isRowComplete(grid: Grid, row: number): boolean {
  for (let col = 0; col < grid.cols; col++) {
    const cell = grid.cells[row][col];
    if (cell.accessible && !cell.letter) {
      return false;
    }
  }
  return true;
}

export function syncPairedCell(grid: Grid, row: number, col: number, letter: string): Grid {
  const cell = grid.cells[row][col];
  
  if (cell.ruleTile && cell.ruleTile.type === 'sameLetterPosition') {
    const ruleTile = cell.ruleTile as SameLetterPositionTile;
    const pairedRow = ruleTile.constraint.pairedRow;
    const pairedCol = ruleTile.constraint.pairedCol;
    
    const newGrid = { ...grid };
    newGrid.cells = grid.cells.map(rowArray => rowArray.map(c => ({ ...c })));
    newGrid.cells[pairedRow][pairedCol].letter = letter;
    newGrid.cells[pairedRow][pairedCol].state = 'filled';
    
    return newGrid;
  }
  
  return grid;
}

function validateRuleTiles(grid: Grid, row: number): boolean {
  for (let col = 0; col < grid.cols; col++) {
    const currentCell = grid.cells[row][col];
    
    if (currentCell.accessible && currentCell.ruleTile && currentCell.ruleTile.type === 'sameLetterPosition') {
      const ruleTile = currentCell.ruleTile as SameLetterPositionTile;
      const pairedRow = ruleTile.constraint.pairedRow;
      const pairedCol = ruleTile.constraint.pairedCol;
      const pairedCell = grid.cells[pairedRow][pairedCol];
      
      if (currentCell.letter !== pairedCell.letter) {
        return false;
      }
    }
  }
  
  return true;
}

export function validateAndUpdateRow(
  gridToValidate: Grid,
  row: number,
  mode: GameMode
): { validatedGrid: Grid; isValid: boolean } {
  let word = '';
  for (let col = 0; col < gridToValidate.cols; col++) {
    const cell = gridToValidate.cells[row][col];
    if (cell.accessible && cell.letter) {
      word += cell.letter;
    }
  }

  const dictionaryValid = DICTIONARY_CHECK_ENABLED 
    ? word.length >= 3 && dictionary.isValidWord(word)
    : true;
  const ruleTilesValid = validateRuleTiles(gridToValidate, row);
  const isValid = dictionaryValid && ruleTilesValid;
  
  const validatedGrid = { ...gridToValidate };
  validatedGrid.cells = gridToValidate.cells.map(rowArray => rowArray.map(cell => ({ ...cell })));

  for (let col = 0; col < validatedGrid.cols; col++) {
    const cell = validatedGrid.cells[row][col];
    if (cell.accessible) {
      cell.validation = isValid ? 'correct' : 'incorrect';
      if (mode === 'action') {
        cell.state = 'locked';
      }
    }
  }

  return { validatedGrid, isValid };
}
