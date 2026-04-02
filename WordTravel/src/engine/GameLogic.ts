import { Grid, GameMode, RuleTile, cloneGrid, getCellRuleTiles, softForbiddenTargetRows } from './types';
import { playerDictionary } from './Dictionary';


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
  return playerDictionary.isValidWord(word);
}

export function validateHardMatchTiles(grid: Grid, row: number): boolean {
  for (let col = 0; col < grid.cols; col++) {
    const currentCell = grid.cells[row][col];
    if (!currentCell.accessible) continue;

    for (const rule of getCellRuleTiles(currentCell)) {
      if (rule.type !== 'hardMatch') continue;
      const { pairedRow, pairedCol } = rule.constraint;
      const pairedCell = grid.cells[pairedRow][pairedCol];
      if (!pairedCell.letter) continue;
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
      if (!sourceCell.accessible) continue;

      if (!isRowComplete(grid, sourceRow)) continue;

      for (const rule of getCellRuleTiles(sourceCell)) {
        if (rule.type !== 'softMatch') continue;
        const letterToFind = sourceCell.letter;
        if (!letterToFind) {
          return false;
        }

        const softTargets = softForbiddenTargetRows(rule.constraint);

        for (const targetRow of softTargets) {
          const validatingTargetRow = targetRow === row;
          const validatingSourceRowWithKnownTarget =
            sourceRow === row && isRowComplete(grid, targetRow);

          if (!validatingTargetRow && !validatingSourceRowWithKnownTarget) continue;

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
      if (!sourceCell.accessible) continue;

      if (!isRowComplete(grid, sourceRow)) continue;

      for (const rule of getCellRuleTiles(sourceCell)) {
        if (rule.type !== 'forbiddenMatch') continue;
        const forbiddenLetter = sourceCell.letter;
        if (!forbiddenLetter) continue;

        for (const targetRow of softForbiddenTargetRows(rule.constraint)) {
          const validatingTargetRow = targetRow === row;
          const validatingSourceRow = sourceRow === row;

          if (!validatingTargetRow && !validatingSourceRow) continue;

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
  const requiredInRow = new Map<number, Set<string>>();
  const bannedFromRow = new Map<number, Set<string>>();

  for (let col = 0; col < grid.cols; col++) {
    const cell = grid.cells[row][col];
    if (!cell.accessible || !cell.letter) continue;

    for (const rule of getCellRuleTiles(cell)) {
      if (rule.type === 'hardMatch' && rule.constraint.position === 'top') {
        const target = rule.constraint.pairedRow;
        if (!requiredInRow.has(target)) requiredInRow.set(target, new Set());
        requiredInRow.get(target)!.add(cell.letter);
      } else if (rule.type === 'softMatch') {
        for (const target of softForbiddenTargetRows(rule.constraint)) {
          if (!requiredInRow.has(target)) requiredInRow.set(target, new Set());
          requiredInRow.get(target)!.add(cell.letter);
        }
      } else if (rule.type === 'forbiddenMatch') {
        for (const target of softForbiddenTargetRows(rule.constraint)) {
          if (!bannedFromRow.has(target)) bannedFromRow.set(target, new Set());
          bannedFromRow.get(target)!.add(cell.letter);
        }
      }
    }
  }

  for (const [targetRow, required] of requiredInRow) {
    const banned = bannedFromRow.get(targetRow);
    if (!banned) continue;
    for (const letter of required) {
      if (banned.has(letter)) return false;
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
  hardMatch: boolean;
  softMatch: boolean;
  forbiddenMatch: boolean;
  noHardMatchForbiddenConflict: boolean;
  uniqueWords: boolean;
  hasHardMatchTile: boolean;
  hasSoftMatchTile: boolean;
  hasForbiddenMatchTile: boolean;
}

export interface RowEvaluationBlockers {
  canEvaluate: boolean;
  rowComplete: boolean;
  needsAbove: boolean;
  needsBelow: boolean;
  blockingRows: number[];
}

export type RowRuleSignalState = 'pending' | 'valid' | 'invalid';

export function getRowValidationState(grid: Grid, row: number): RowValidationState {
  let hasHardMatchTile = false;
  let hasSoftMatchTile = false;
  let hasForbiddenMatchTile = false;
  
  for (let col = 0; col < grid.cols; col++) {
    const cell = grid.cells[row][col];
    if (cell.accessible) {
      for (const rule of getCellRuleTiles(cell)) {
        if (rule.type === 'hardMatch') {
          hasHardMatchTile = true;
        }
        if (rule.type === 'softMatch') {
          hasSoftMatchTile = true;
        }
        if (rule.type === 'forbiddenMatch') {
          hasForbiddenMatchTile = true;
        }
      }
    }
  }

  for (let sourceRow = 0; sourceRow < grid.rows; sourceRow++) {
    for (let col = 0; col < grid.cols; col++) {
      const sourceCell = grid.cells[sourceRow][col];
      if (!sourceCell.accessible) continue;
      for (const rule of getCellRuleTiles(sourceCell)) {
        if (rule.type === 'softMatch' && softForbiddenTargetRows(rule.constraint).includes(row)) {
          hasSoftMatchTile = true;
        }
        if (rule.type === 'forbiddenMatch' && softForbiddenTargetRows(rule.constraint).includes(row)) {
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

export function getRowEvaluationBlockers(grid: Grid, row: number): RowEvaluationBlockers {
  const rowComplete = isRowComplete(grid, row);
  if (!rowComplete) {
    return {
      canEvaluate: false,
      rowComplete: false,
      needsAbove: false,
      needsBelow: false,
      blockingRows: [],
    };
  }

  const requiredRows = new Set<number>();
  const addRequiredRow = (candidateRow: number) => {
    if (candidateRow < 0 || candidateRow >= grid.rows || candidateRow === row) return;
    if (!isRowComplete(grid, candidateRow)) {
      requiredRows.add(candidateRow);
    }
  };

  for (let col = 0; col < grid.cols; col++) {
    const rowCell = grid.cells[row][col];
    if (!rowCell.accessible) continue;

    for (const rule of getCellRuleTiles(rowCell)) {
      if (rule.type === 'hardMatch') {
        addRequiredRow(rule.constraint.pairedRow);
        continue;
      }

      for (const targetRow of softForbiddenTargetRows(rule.constraint)) {
        addRequiredRow(targetRow);
      }
    }
  }

  for (let sourceRow = 0; sourceRow < grid.rows; sourceRow++) {
    if (sourceRow === row) continue;

    for (let col = 0; col < grid.cols; col++) {
      const sourceCell = grid.cells[sourceRow][col];
      if (!sourceCell.accessible) continue;

      for (const rule of getCellRuleTiles(sourceCell)) {
        if (rule.type === 'softMatch' || rule.type === 'forbiddenMatch') {
          const targets = softForbiddenTargetRows(rule.constraint);
          if (targets.includes(row)) {
            addRequiredRow(sourceRow);
          }
        }
      }
    }
  }

  const blockingRows = Array.from(requiredRows).sort((a, b) => a - b);
  return {
    canEvaluate: blockingRows.length === 0,
    rowComplete: true,
    needsAbove: blockingRows.some(r => r < row),
    needsBelow: blockingRows.some(r => r > row),
    blockingRows,
  };
}

export function getRowRuleSignalState(grid: Grid, row: number): RowRuleSignalState {
  const blockers = getRowEvaluationBlockers(grid, row);
  if (!blockers.canEvaluate) return 'pending';

  const validationState = getRowValidationState(grid, row);
  const isValid =
    validationState.spelling &&
    validationState.hardMatch &&
    validationState.softMatch &&
    validationState.forbiddenMatch &&
    validationState.noHardMatchForbiddenConflict &&
    validationState.uniqueWords;

  return isValid ? 'valid' : 'invalid';
}

function ruleAppliesToRow(sourceRow: number, targetRow: number, rule: RuleTile): boolean {
  if (rule.type === 'hardMatch') {
    return sourceRow === targetRow || rule.constraint.pairedRow === targetRow;
  }

  return sourceRow === targetRow || softForbiddenTargetRows(rule.constraint).includes(targetRow);
}

function computeSingleRuleFulfillment(grid: Grid, row: number, col: number, rule: RuleTile): RuleFulfillment {
  const cell = grid.cells[row][col];
  if (rule.type === 'hardMatch') {
    const { pairedRow, pairedCol } = rule.constraint;
    if (!isRowComplete(grid, row) || !isRowComplete(grid, pairedRow)) return 'neutral';
    return cell.letter === grid.cells[pairedRow][pairedCol].letter ? 'fulfilled' : 'broken';
  }

  const targets = softForbiddenTargetRows(rule.constraint);
  if (targets.length === 0) return 'neutral';
  if (!isRowComplete(grid, row)) return 'neutral';
  for (const tr of targets) {
    if (!isRowComplete(grid, tr)) return 'neutral';
  }

  const letterAppearsInRow = (targetRow: number): boolean => {
    const letter = cell.letter;
    if (!letter) return false;
    for (let c = 0; c < grid.cols; c++) {
      const target = grid.cells[targetRow][c];
      if (target.accessible && target.letter === letter) return true;
    }
    return false;
  };

  if (rule.type === 'softMatch') {
    for (const tr of targets) {
      if (!letterAppearsInRow(tr)) return 'broken';
    }
    return 'fulfilled';
  }
  for (const tr of targets) {
    if (letterAppearsInRow(tr)) return 'broken';
  }
  return 'fulfilled';
}

export function getBrokenApplicableRuleCells(grid: Grid, row: number): Array<{ row: number; col: number }> {
  const brokenCells: Array<{ row: number; col: number }> = [];

  for (let sourceRow = 0; sourceRow < grid.rows; sourceRow++) {
    for (let col = 0; col < grid.cols; col++) {
      const cell = grid.cells[sourceRow][col];
      if (!cell.accessible) continue;
      const rules = getCellRuleTiles(cell);
      if (rules.length === 0) continue;

      const hasBrokenApplicableRule = rules.some(rule =>
        ruleAppliesToRow(sourceRow, row, rule) &&
        computeSingleRuleFulfillment(grid, sourceRow, col, rule) === 'broken'
      );
      if (hasBrokenApplicableRule) {
        brokenCells.push({ row: sourceRow, col });
      }
    }
  }

  return brokenCells;
}

export type RuleFulfillment = 'neutral' | 'fulfilled' | 'broken';

export function computeRuleFulfillment(grid: Grid, row: number, col: number): RuleFulfillment {
  const cell = grid.cells[row][col];
  const rules = getCellRuleTiles(cell);
  if (rules.length === 0) return 'neutral';

  let hasFulfilled = false;
  for (const rule of rules) {
    const fulfillment = computeSingleRuleFulfillment(grid, row, col, rule);
    if (fulfillment === 'broken') return 'broken';
    if (fulfillment === 'fulfilled') hasFulfilled = true;
  }

  return hasFulfilled ? 'fulfilled' : 'neutral';
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
  
  const validatedGrid = cloneGrid(gridToValidate);

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
