import { Grid, GameMode, SameLetterPositionTile, SameLetterTile } from './types';
import { dictionary } from './Dictionary';

const DICTIONARY_CHECK_ENABLED = true;

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


export function validateSpelling(grid: Grid, row: number): boolean {
  if (!DICTIONARY_CHECK_ENABLED) {
    return true;
  }
  
  const word = getWordFromRow(grid, row);
  return word.length >= 3 && dictionary.isValidWord(word);
}

export function validateSameLetterPositionTiles(grid: Grid, row: number): boolean {
  for (let col = 0; col < grid.cols; col++) {
    const currentCell = grid.cells[row][col];
    
    if (currentCell.accessible && currentCell.ruleTile?.type === 'sameLetterPosition') {
      const ruleTile = currentCell.ruleTile as SameLetterPositionTile;
      const pairedRow = ruleTile.constraint.pairedRow;
      const pairedCol = ruleTile.constraint.pairedCol;

      if (!isRowComplete(grid, pairedRow)) continue;

      const pairedCell = grid.cells[pairedRow][pairedCol];
      if (currentCell.letter !== pairedCell.letter) {
        return false;
      }
    }
  }
  
  return true;
}

export function validateSameLetterTiles(grid: Grid, row: number): boolean {
  for (let sourceRow = 0; sourceRow < grid.rows; sourceRow++) {
    for (let col = 0; col < grid.cols; col++) {
      const sourceCell = grid.cells[sourceRow][col];
      
      if (sourceCell.accessible && sourceCell.ruleTile?.type === 'sameLetter') {
        const ruleTile = sourceCell.ruleTile as SameLetterTile;
        const targetRow = ruleTile.constraint.nextRow;
        
        if (targetRow === row) {
          if (!isRowComplete(grid, sourceRow)) continue;

          const letterToFind = sourceCell.letter;
          
          if (!letterToFind) {
            return false;
          }
          
          let foundInTargetRow = false;
          for (let targetCol = 0; targetCol < grid.cols; targetCol++) {
            const targetCell = grid.cells[targetRow][targetCol];
            if (targetCell.accessible && targetCell.letter === letterToFind) {
              foundInTargetRow = true;
              break;
            }
          }
          
          if (!foundInTargetRow) {
            return false;
          }
        }
      }
    }
  }
  
  return true;
}

export function validateUniqueWords(grid: Grid, row: number): boolean {
  const currentWord = getWordFromRow(grid, row);
  
  if (currentWord.length === 0) {
    return true;
  }
  
  for (let otherRow = 0; otherRow < grid.rows; otherRow++) {
    if (otherRow === row) {
      continue;
    }
    
    if (!isRowComplete(grid, otherRow)) {
      continue;
    }
    
    const otherWord = getWordFromRow(grid, otherRow);
    if (currentWord.toLowerCase() === otherWord.toLowerCase()) {
      return false;
    }
  }
  
  return true;
}

export interface RowValidationState {
  spelling: boolean;
  sameLetterPosition: boolean;
  sameLetter: boolean;
  uniqueWords: boolean;
  hasSameLetterPositionTile: boolean;
  hasSameLetterTile: boolean;
}

export function getRowValidationState(grid: Grid, row: number): RowValidationState {
  let hasSameLetterPositionTile = false;
  let hasSameLetterTile = false;
  
  for (let col = 0; col < grid.cols; col++) {
    const cell = grid.cells[row][col];
    if (cell.accessible && cell.ruleTile) {
      if (cell.ruleTile.type === 'sameLetterPosition') {
        hasSameLetterPositionTile = true;
      }
    }
  }
  
  for (let sourceRow = 0; sourceRow < grid.rows; sourceRow++) {
    for (let col = 0; col < grid.cols; col++) {
      const sourceCell = grid.cells[sourceRow][col];
      if (sourceCell.accessible && sourceCell.ruleTile?.type === 'sameLetter') {
        const ruleTile = sourceCell.ruleTile as SameLetterTile;
        if (ruleTile.constraint.nextRow === row) {
          hasSameLetterTile = true;
          break;
        }
      }
    }
    if (hasSameLetterTile) break;
  }
  
  return {
    spelling: validateSpelling(grid, row),
    sameLetterPosition: validateSameLetterPositionTiles(grid, row),
    sameLetter: validateSameLetterTiles(grid, row),
    uniqueWords: validateUniqueWords(grid, row),
    hasSameLetterPositionTile,
    hasSameLetterTile,
  };
}

export function validateAndUpdateRow(
  gridToValidate: Grid,
  row: number,
  mode: GameMode
): { validatedGrid: Grid; isValid: boolean } {
  const spellingValid = validateSpelling(gridToValidate, row);
  const sameLetterPositionValid = validateSameLetterPositionTiles(gridToValidate, row);
  const sameLetterValid = validateSameLetterTiles(gridToValidate, row);
  const uniqueWordsValid = validateUniqueWords(gridToValidate, row);
  
  const isValid = spellingValid && sameLetterPositionValid && sameLetterValid && uniqueWordsValid;
  
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
