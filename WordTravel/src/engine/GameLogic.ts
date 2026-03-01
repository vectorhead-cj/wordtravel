import { Grid, GameMode, HardMatchTile, SoftMatchTile, ForbiddenMatchTile } from './types';
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
  if (!DICTIONARY_CHECK_ENABLED) return true;
  const word = getWordFromRow(grid, row);
  if (word.length < 3) return true;
  return dictionary.isValidWord(word);
}

export function validateHardMatchTiles(grid: Grid, row: number): boolean {
  for (let col = 0; col < grid.cols; col++) {
    const currentCell = grid.cells[row][col];
    
    if (currentCell.accessible && currentCell.ruleTile?.type === 'hardMatch') {
      const ruleTile = currentCell.ruleTile as HardMatchTile;
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

export function validateSoftMatchTiles(grid: Grid, row: number): boolean {
  for (let sourceRow = 0; sourceRow < grid.rows; sourceRow++) {
    for (let col = 0; col < grid.cols; col++) {
      const sourceCell = grid.cells[sourceRow][col];
      
      if (sourceCell.accessible && sourceCell.ruleTile?.type === 'softMatch') {
        const ruleTile = sourceCell.ruleTile as SoftMatchTile;
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

export function validateForbiddenMatchTiles(grid: Grid, row: number): boolean {
  for (let sourceRow = 0; sourceRow < grid.rows; sourceRow++) {
    for (let col = 0; col < grid.cols; col++) {
      const sourceCell = grid.cells[sourceRow][col];

      if (sourceCell.accessible && sourceCell.ruleTile?.type === 'forbiddenMatch') {
        const ruleTile = sourceCell.ruleTile as ForbiddenMatchTile;
        const targetRow = ruleTile.constraint.nextRow;

        if (targetRow === row) {
          if (!isRowComplete(grid, sourceRow)) continue;

          const forbiddenLetter = sourceCell.letter;
          if (!forbiddenLetter) continue;

          for (let targetCol = 0; targetCol < grid.cols; targetCol++) {
            const targetCell = grid.cells[targetRow][targetCol];
            if (targetCell.accessible && targetCell.letter === forbiddenLetter) {
              return false;
            }
          }
        }
      }
    }
  }

  return true;
}

export function validateNoHardMatchForbiddenConflict(grid: Grid, row: number): boolean {
  const hardMatchLetters = new Set<string>();
  const forbiddenMatchLetters = new Set<string>();

  for (let col = 0; col < grid.cols; col++) {
    const cell = grid.cells[row][col];
    if (!cell.accessible || !cell.letter || !cell.ruleTile) continue;

    if (cell.ruleTile.type === 'hardMatch') {
      hardMatchLetters.add(cell.letter);
    } else if (cell.ruleTile.type === 'forbiddenMatch') {
      forbiddenMatchLetters.add(cell.letter);
    }
  }

  for (const letter of hardMatchLetters) {
    if (forbiddenMatchLetters.has(letter)) return false;
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
  hardMatch: boolean;
  softMatch: boolean;
  forbiddenMatch: boolean;
  noHardMatchForbiddenConflict: boolean;
  uniqueWords: boolean;
  hasHardMatchTile: boolean;
  hasSoftMatchTile: boolean;
  hasForbiddenMatchTile: boolean;
}

export function getRowValidationState(grid: Grid, row: number): RowValidationState {
  let hasHardMatchTile = false;
  let hasSoftMatchTile = false;
  let hasForbiddenMatchTile = false;
  
  for (let col = 0; col < grid.cols; col++) {
    const cell = grid.cells[row][col];
    if (cell.accessible && cell.ruleTile) {
      if (cell.ruleTile.type === 'hardMatch') {
        hasHardMatchTile = true;
      }
    }
  }
  
  for (let sourceRow = 0; sourceRow < grid.rows; sourceRow++) {
    for (let col = 0; col < grid.cols; col++) {
      const sourceCell = grid.cells[sourceRow][col];
      if (sourceCell.accessible && sourceCell.ruleTile?.type === 'softMatch') {
        const ruleTile = sourceCell.ruleTile as SoftMatchTile;
        if (ruleTile.constraint.nextRow === row) {
          hasSoftMatchTile = true;
        }
      }
      if (sourceCell.accessible && sourceCell.ruleTile?.type === 'forbiddenMatch') {
        const ruleTile = sourceCell.ruleTile as ForbiddenMatchTile;
        if (ruleTile.constraint.nextRow === row) {
          hasForbiddenMatchTile = true;
        }
      }
    }
  }
  
  return {
    spelling: validateSpelling(grid, row),
    hardMatch: validateHardMatchTiles(grid, row),
    softMatch: validateSoftMatchTiles(grid, row),
    forbiddenMatch: validateForbiddenMatchTiles(grid, row),
    noHardMatchForbiddenConflict: validateNoHardMatchForbiddenConflict(grid, row),
    uniqueWords: validateUniqueWords(grid, row),
    hasHardMatchTile,
    hasSoftMatchTile,
    hasForbiddenMatchTile,
  };
}

/**
 * Counts how many valid dictionary words can be placed in targetRow given
 * the constraints imposed by already-completed rows. Only considers constraints
 * from completed rows; returns 0 if targetRow is already complete.
 *
 * Constraints evaluated:
 *   hardMatch  — specific word-index must match a letter from a completed paired row
 *   softMatch  — a letter from a completed source row must appear somewhere in the word
 *   forbiddenMatch — a letter from a completed source row must NOT appear in the word
 *   uniqueWords — word must not already be used in any other completed row
 */
export function countValidNextWords(grid: Grid, targetRow: number): number {
  if (isRowComplete(grid, targetRow)) return 0;

  // Ordered list of accessible column indices in targetRow
  const accessibleCols: number[] = [];
  for (let col = 0; col < grid.cols; col++) {
    if (grid.cells[targetRow][col].accessible) {
      accessibleCols.push(col);
    }
  }
  const wordLength = accessibleCols.length;
  if (wordLength === 0) return 0;

  // Words used in other completed rows (uniqueWords constraint)
  const usedWords = new Set<string>();
  for (let row = 0; row < grid.rows; row++) {
    if (row !== targetRow && isRowComplete(grid, row)) {
      usedWords.add(getWordFromRow(grid, row).toLowerCase());
    }
  }

  // hardMatch: wordIndex → required letter (from a completed paired row)
  const hardMatchConstraints = new Map<number, string>();
  for (let i = 0; i < accessibleCols.length; i++) {
    const col = accessibleCols[i];
    const cell = grid.cells[targetRow][col];
    if (cell.ruleTile?.type === 'hardMatch') {
      const { pairedRow, pairedCol } = (cell.ruleTile as HardMatchTile).constraint;
      if (isRowComplete(grid, pairedRow)) {
        const letter = grid.cells[pairedRow][pairedCol].letter;
        if (letter) hardMatchConstraints.set(i, letter.toLowerCase());
      }
    }
  }

  // softMatch / forbiddenMatch: scan completed source rows for rules targeting targetRow
  const softMatchRequired: string[] = [];
  const forbiddenLetters = new Set<string>();
  for (let sourceRow = 0; sourceRow < grid.rows; sourceRow++) {
    if (!isRowComplete(grid, sourceRow)) continue;
    for (let col = 0; col < grid.cols; col++) {
      const cell = grid.cells[sourceRow][col];
      if (!cell.accessible || !cell.letter || !cell.ruleTile) continue;

      if (cell.ruleTile.type === 'softMatch') {
        const ruleTile = cell.ruleTile as SoftMatchTile;
        if (ruleTile.constraint.nextRow === targetRow) {
          softMatchRequired.push(cell.letter.toLowerCase());
        }
      } else if (cell.ruleTile.type === 'forbiddenMatch') {
        const ruleTile = cell.ruleTile as ForbiddenMatchTile;
        if (ruleTile.constraint.nextRow === targetRow) {
          forbiddenLetters.add(cell.letter.toLowerCase());
        }
      }
    }
  }

  const hasActiveConstraints =
    hardMatchConstraints.size > 0 ||
    softMatchRequired.length > 0 ||
    forbiddenLetters.size > 0;

  if (!hasActiveConstraints) {
    return 0;
  }

  // Find the nearest completed source row to label the debug output
  let previousWord = '(unknown)';
  for (let r = targetRow - 1; r >= 0; r--) {
    if (isRowComplete(grid, r)) {
      previousWord = getWordFromRow(grid, r);
      break;
    }
  }

  const count = dictionary.getWordsOfLength(wordLength).filter(word => {
    if (usedWords.has(word)) return false;
    for (const [idx, letter] of hardMatchConstraints) {
      if (word[idx] !== letter) return false;
    }
    for (const letter of forbiddenLetters) {
      if (word.includes(letter)) return false;
    }
    for (const letter of softMatchRequired) {
      if (!word.includes(letter)) return false;
    }
    return true;
  }).length;

  console.log(
    `[WordTravel] possible ${wordLength} letter words that satisfy rules after "${previousWord}": ${count}` +
    ` [hard=${[...hardMatchConstraints.entries()].map(([i,l])=>`[${i}]=${l}`).join(',')}` +
    ` soft=${softMatchRequired.join(',')}` +
    ` forbidden=${[...forbiddenLetters].join(',')}]`
  );

  return count;
}

export function validateAndUpdateRow(
  gridToValidate: Grid,
  row: number,
  mode: GameMode
): { validatedGrid: Grid; isValid: boolean } {
  const spellingValid = validateSpelling(gridToValidate, row);
  const hardMatchValid = validateHardMatchTiles(gridToValidate, row);
  const softMatchValid = validateSoftMatchTiles(gridToValidate, row);
  const forbiddenMatchValid = validateForbiddenMatchTiles(gridToValidate, row);
  const noConflictValid = validateNoHardMatchForbiddenConflict(gridToValidate, row);
  const uniqueWordsValid = validateUniqueWords(gridToValidate, row);

  const isValid = spellingValid && hardMatchValid && softMatchValid && forbiddenMatchValid && noConflictValid && uniqueWordsValid;
  
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
