import { Grid, getCellRuleTiles, softForbiddenTargetRows } from './types';
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

    for (const rule of getCellRuleTiles(cell)) {
      if (rule.type !== 'hardMatch') continue;
      const { pairedRow, pairedCol } = rule.constraint;
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
      if (!cell.accessible || !cell.letter) continue;
      for (const rule of getCellRuleTiles(cell)) {
        if (rule.type === 'softMatch') {
          if (softForbiddenTargetRows(rule.constraint).includes(targetRow)) {
            softMatchRequired.push(cell.letter.toLowerCase());
          }
        } else if (rule.type === 'forbiddenMatch') {
          if (softForbiddenTargetRows(rule.constraint).includes(targetRow)) {
            forbiddenLetters.add(cell.letter.toLowerCase());
          }
        }
      }
    }
  }

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
    const forbiddenRules = getCellRuleTiles(cell).filter(rule => rule.type === 'forbiddenMatch');
    if (forbiddenRules.length === 0) continue;
    const requiredUnion = new Set<string>();
    for (const forbiddenRule of forbiddenRules) {
      for (const destRow of softForbiddenTargetRows(forbiddenRule.constraint)) {
        const destRowCells = grid.cells[destRow];
        if (!destRowCells) continue;

        const requiredInDest = new Set<string>();

        if (isRowComplete(grid, destRow)) {
          for (const destCell of destRowCells) {
            if (destCell.accessible && destCell.letter) {
              requiredInDest.add(destCell.letter.toLowerCase());
            }
          }
        } else {
          for (const destCell of destRowCells) {
            if (!destCell.accessible) continue;

            if (destCell.fixed && destCell.letter) {
              requiredInDest.add(destCell.letter.toLowerCase());
            } else {
              for (const destRule of getCellRuleTiles(destCell)) {
                if (destRule.type !== 'hardMatch') continue;
                const { pairedRow, pairedCol } = destRule.constraint;
                const pairedCell = grid.cells[pairedRow]?.[pairedCol];
                if (pairedCell?.letter) {
                  requiredInDest.add(pairedCell.letter.toLowerCase());
                } else if (pairedRow === targetRow) {
                  const required = colToHardMatchLetter.get(pairedCol);
                  if (required) requiredInDest.add(required);
                }
              }
            }
          }

          for (let sourceRow = 0; sourceRow < grid.rows; sourceRow++) {
            if (!isRowComplete(grid, sourceRow)) continue;
            for (let sourceCol = 0; sourceCol < grid.cols; sourceCol++) {
              const sourceCell = grid.cells[sourceRow][sourceCol];
              if (!sourceCell.accessible || !sourceCell.letter) continue;
              for (const sourceRule of getCellRuleTiles(sourceCell)) {
                if (sourceRule.type !== 'softMatch') continue;
                if (softForbiddenTargetRows(sourceRule.constraint).includes(destRow)) {
                  requiredInDest.add(sourceCell.letter.toLowerCase());
                }
              }
            }
          }
        }

        for (const letter of requiredInDest) {
          requiredUnion.add(letter);
        }
      }
    }

    if (requiredUnion.size > 0) {
      positionForbiddenLetters.set(i, requiredUnion);
    }
  }

  // For each softMatch tile in targetRow, the letter placed there must appear
  // somewhere in the pointed-to next row. If that row is already complete we
  // can restrict the position to only its unique letters.
  const positionAllowedLetters = new Map<number, Set<string>>();
  for (let i = 0; i < accessibleCols.length; i++) {
    const col = accessibleCols[i];
    const cell = grid.cells[targetRow][col];
    const softRules = getCellRuleTiles(cell).filter(rule => rule.type === 'softMatch');
    if (softRules.length === 0) continue;

    const letterSets: Set<string>[] = [];
    for (const softRule of softRules) {
      const constraint = softRule.constraint;
      if (constraint.nextRow !== undefined && isRowComplete(grid, constraint.nextRow)) {
        const letters = new Set<string>();
        for (let c = 0; c < grid.cols; c++) {
          const t = grid.cells[constraint.nextRow][c];
          if (t.accessible && t.letter) {
            letters.add(t.letter.toLowerCase());
          }
        }
        if (letters.size > 0) letterSets.push(letters);
      }
      if (constraint.prevRow !== undefined && isRowComplete(grid, constraint.prevRow)) {
        const letters = new Set<string>();
        for (let c = 0; c < grid.cols; c++) {
          const t = grid.cells[constraint.prevRow][c];
          if (t.accessible && t.letter) {
            letters.add(t.letter.toLowerCase());
          }
        }
        if (letters.size > 0) letterSets.push(letters);
      }
    }
    if (letterSets.length === 0) continue;

    let allowed = letterSets[0];
    for (let k = 1; k < letterSets.length; k++) {
      allowed = new Set([...allowed].filter(x => letterSets[k].has(x)));
    }
    if (allowed.size > 0) {
      positionAllowedLetters.set(i, allowed);
    }
  }

  const hasActiveConstraints =
    hardMatchConstraints.size > 0 ||
    softMatchRequired.length > 0 ||
    forbiddenLetters.size > 0 ||
    positionForbiddenLetters.size > 0 ||
    positionAllowedLetters.size > 0;

  if (!hasActiveConstraints) return [];

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
