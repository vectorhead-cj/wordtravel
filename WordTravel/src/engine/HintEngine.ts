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

  const words = generatorDictionary.getWordsMatchingConstraints(wordLength, {
    positionConstraints: hardMatchConstraints.size > 0 ? hardMatchConstraints : undefined,
    mustContain: softMatchRequired.length > 0 ? softMatchRequired : undefined,
    mustNotContain: forbiddenLetters.size > 0 ? forbiddenLetters : undefined,
    excludeWords: usedWords.size > 0 ? usedWords : undefined,
  });

  let previousWord = '(unknown)';
  for (let r = targetRow - 1; r >= 0; r--) {
    if (isRowComplete(grid, r)) {
      previousWord = getWordFromRow(grid, r);
      break;
    }
  }
  console.log(
    `[WordTravel] possible ${wordLength} letter words that satisfy rules after "${previousWord}": ${words.length}` +
    ` [hard=${[...hardMatchConstraints.entries()].map(([i,l])=>`[${i}]=${l}`).join(',')}` +
    ` soft=${softMatchRequired.join(',')}` +
    ` forbidden=${[...forbiddenLetters].join(',')}]`
  );

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
