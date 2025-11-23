import { Grid, Cell, GameMode } from './types';
import { dictionary } from './Dictionary';

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

export function validateWord(word: string): boolean {
  return dictionary.isValidWord(word);
}

export function validateRow(grid: Grid, row: number): { isValid: boolean; word: string } {
  const word = getWordFromRow(grid, row);
  const isValid = validateWord(word);
  return { isValid, word };
}

export function findNextAccessibleRow(grid: Grid, currentRow: number): number | null {
  for (let row = currentRow + 1; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      if (grid.cells[row][col].accessible) {
        return row;
      }
    }
  }
  return null;
}

export function canEditRow(grid: Grid, row: number, mode: GameMode): boolean {
  if (mode === 'action') {
    const hasValidation = grid.cells[row].some(
      cell => cell.validation !== 'none'
    );
    return !hasValidation;
  }
  return true;
}

