import { Grid } from './types';
import { generatorDictionary } from './Dictionary';
import { isRowComplete, getWordFromRow } from './GameLogic';

function getMatchingWordsForRow(grid: Grid, targetRow: number): string[] {
  if (isRowComplete(grid, targetRow)) return [];

  const accessibleCols: number[] = [];
  for (let col = 0; col < grid.cols; col++) {
    if (grid.cells[targetRow][col].accessible) {
      accessibleCols.push(col);
    }
  }
  const wordLength = accessibleCols.length;
  if (wordLength === 0) return [];

  const usedWords = new Set<string>();
  for (let row = 0; row < grid.rows; row++) {
    if (row !== targetRow && isRowComplete(grid, row)) {
      usedWords.add(getWordFromRow(grid, row).toLowerCase());
    }
  }

  const hardMatchConstraints = new Map<number, string>();
  for (let i = 0; i < accessibleCols.length; i++) {
    const col = accessibleCols[i];
    const cell = grid.cells[targetRow][col];

    if (cell.fixed && cell.letter) {
      hardMatchConstraints.set(i, cell.letter.toLowerCase());
      continue;
    }

    if (cell.ruleTile?.type === 'hardMatch') {
      const { pairedRow, pairedCol } = cell.ruleTile.constraint;
      const pairedCell = grid.cells[pairedRow]?.[pairedCol];
      if (pairedCell?.letter) {
        hardMatchConstraints.set(i, pairedCell.letter.toLowerCase());
      }
    }
  }

  const softMatchRequired: string[] = [];
  const forbiddenLetters = new Set<string>();
  for (let sourceRow = 0; sourceRow < grid.rows; sourceRow++) {
    if (!isRowComplete(grid, sourceRow)) continue;
    for (let col = 0; col < grid.cols; col++) {
      const cell = grid.cells[sourceRow][col];
      if (!cell.accessible || !cell.letter || !cell.ruleTile) continue;

      if (cell.ruleTile.type === 'softMatch') {
        if (cell.ruleTile.constraint.nextRow === targetRow) {
          softMatchRequired.push(cell.letter.toLowerCase());
        }
      } else if (cell.ruleTile.type === 'forbiddenMatch') {
        if (cell.ruleTile.constraint.nextRow === targetRow) {
          forbiddenLetters.add(cell.letter.toLowerCase());
        }
      }
    }
  }

  const hasActiveConstraints =
    hardMatchConstraints.size > 0 ||
    softMatchRequired.length > 0 ||
    forbiddenLetters.size > 0;

  if (!hasActiveConstraints) return [];

  // For each forbiddenMatch tile in targetRow, the letter placed there will be
  // forbidden in the pointed-to next row. Collect ALL letters required in that
  // next row (fixed cells, hardMatch constraints, and softMatch from completed rows)
  // so we can reject candidate words that would place a required letter there.
  const colToHardMatchLetter = new Map<number, string>();
  for (const [i, letter] of hardMatchConstraints) {
    colToHardMatchLetter.set(accessibleCols[i], letter);
  }

  const positionForbiddenLetters = new Map<number, Set<string>>();
  for (let i = 0; i < accessibleCols.length; i++) {
    const col = accessibleCols[i];
    const cell = grid.cells[targetRow][col];
    if (cell.ruleTile?.type !== 'forbiddenMatch') continue;

    const { nextRow } = cell.ruleTile.constraint;
    const nextRowCells = grid.cells[nextRow];
    if (!nextRowCells) continue;

    const requiredInNextRow = new Set<string>();

    for (const nextCell of nextRowCells) {
      if (!nextCell.accessible) continue;

      if (nextCell.fixed && nextCell.letter) {
        requiredInNextRow.add(nextCell.letter.toLowerCase());
      } else if (nextCell.ruleTile?.type === 'hardMatch') {
        const { pairedRow, pairedCol } = nextCell.ruleTile.constraint;
        const pairedCell = grid.cells[pairedRow]?.[pairedCol];
        if (pairedCell?.letter) {
          requiredInNextRow.add(pairedCell.letter.toLowerCase());
        } else if (pairedRow === targetRow) {
          // Paired with the target row we're filling — consult its known constraints
          const required = colToHardMatchLetter.get(pairedCol);
          if (required) requiredInNextRow.add(required);
        }
      }
    }

    for (let sourceRow = 0; sourceRow < grid.rows; sourceRow++) {
      if (!isRowComplete(grid, sourceRow)) continue;
      for (let sourceCol = 0; sourceCol < grid.cols; sourceCol++) {
        const sourceCell = grid.cells[sourceRow][sourceCol];
        if (
          sourceCell.accessible &&
          sourceCell.ruleTile?.type === 'softMatch' &&
          sourceCell.ruleTile.constraint.nextRow === nextRow &&
          sourceCell.letter
        ) {
          requiredInNextRow.add(sourceCell.letter.toLowerCase());
        }
      }
    }

    if (requiredInNextRow.size > 0) {
      positionForbiddenLetters.set(i, requiredInNextRow);
    }
  }

  // For each softMatch tile in targetRow, the letter placed there must appear
  // somewhere in the pointed-to next row. If that row is already complete we
  // can restrict the position to only its unique letters.
  const positionAllowedLetters = new Map<number, Set<string>>();
  for (let i = 0; i < accessibleCols.length; i++) {
    const col = accessibleCols[i];
    const cell = grid.cells[targetRow][col];
    if (cell.ruleTile?.type !== 'softMatch') continue;

    const { nextRow } = cell.ruleTile.constraint;
    if (!isRowComplete(grid, nextRow)) continue;

    const nextRowLetters = new Set<string>();
    for (let c = 0; c < grid.cols; c++) {
      const nextCell = grid.cells[nextRow][c];
      if (nextCell.accessible && nextCell.letter) {
        nextRowLetters.add(nextCell.letter.toLowerCase());
      }
    }
    if (nextRowLetters.size > 0) {
      positionAllowedLetters.set(i, nextRowLetters);
    }
  }

  let words = generatorDictionary.getWordsMatchingConstraints(wordLength, {
    positionConstraints: hardMatchConstraints.size > 0 ? hardMatchConstraints : undefined,
    mustContain: softMatchRequired.length > 0 ? softMatchRequired : undefined,
    mustNotContain: forbiddenLetters.size > 0 ? forbiddenLetters : undefined,
    excludeWords: usedWords.size > 0 ? usedWords : undefined,
  });

  if (positionForbiddenLetters.size > 0) {
    words = words.filter(word => {
      for (const [pos, forbidden] of positionForbiddenLetters) {
        if (forbidden.has(word[pos])) return false;
      }
      return true;
    });
  }

  if (positionAllowedLetters.size > 0) {
    words = words.filter(word => {
      for (const [pos, allowed] of positionAllowedLetters) {
        if (!allowed.has(word[pos])) return false;
      }
      return true;
    });
  }

  let previousWord = '(unknown)';
  for (let r = targetRow - 1; r >= 0; r--) {
    if (isRowComplete(grid, r)) {
      previousWord = getWordFromRow(grid, r);
      break;
    }
  }

  return words;
}

/**
 * Counts how many valid generator-dictionary words can be placed in targetRow
 * given the constraints imposed by already-completed rows.
 */
export function countValidNextWords(grid: Grid, targetRow: number): number {
  return getMatchingWordsForRow(grid, targetRow).length;
}

export interface ValidNextWordsResult {
  count: number;
  examples: string[];
}

/**
 * Returns count and up to exampleLimit matching words for targetRow.
 */
export function getValidNextWords(
  grid: Grid,
  targetRow: number,
  exampleLimit: number
): ValidNextWordsResult {
  const words = getMatchingWordsForRow(grid, targetRow);
  return {
    count: words.length,
    examples: words.slice(0, exampleLimit),
  };
}
