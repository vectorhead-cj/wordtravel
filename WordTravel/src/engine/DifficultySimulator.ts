import { Grid, Difficulty, cloneGrid, softForbiddenTargetRows } from './types';
import { ConstraintQuery, generatorDictionary } from './Dictionary';
import { PUZZLE_CONFIG } from './config';

export interface SimulationResult {
  successRate: number;
  difficulty: Difficulty | null;
  trials: number;
}

export function classifyDifficulty(successRate: number): Difficulty | null {
  const { easy, medium, hard } = PUZZLE_CONFIG.DIFFICULTY_THRESHOLDS;
  if (successRate >= easy) return 'easy';
  if (successRate >= medium) return 'medium';
  if (successRate >= hard) return 'hard';
  return null;
}

export function simulatePuzzleDifficulty(
  grid: Grid,
  trials: number = PUZZLE_CONFIG.DIFFICULTY_SIMULATION_TRIALS,
): SimulationResult {
  let successes = 0;
  for (let i = 0; i < trials; i++) {
    if (simulateTrial(grid)) successes++;
  }
  const successRate = successes / trials;
  return {
    successRate,
    difficulty: classifyDifficulty(successRate),
    trials,
  };
}

interface RowInfo {
  row: number;
  accessibleCols: number[];
  wordLength: number;
  allFixed: boolean;
}

function getRowInfo(grid: Grid): RowInfo[] {
  const rows: RowInfo[] = [];
  for (let row = 0; row < grid.rows; row++) {
    const accessibleCols: number[] = [];
    for (let col = 0; col < grid.cols; col++) {
      if (grid.cells[row][col].accessible) {
        accessibleCols.push(col);
      }
    }
    if (accessibleCols.length === 0) continue;

    const allFixed = accessibleCols.every(c => grid.cells[row][c].fixed);
    rows.push({ row, accessibleCols, wordLength: accessibleCols.length, allFixed });
  }
  return rows;
}

function getWordFromCols(grid: Grid, row: number, cols: number[]): string {
  let word = '';
  for (const col of cols) {
    word += grid.cells[row][col].letter ?? '';
  }
  return word;
}

function simulateTrial(originalGrid: Grid): boolean {
  const grid = cloneGrid(originalGrid);
  const rowInfos = getRowInfo(grid);

  const usedWords = new Set<string>();
  for (const info of rowInfos) {
    if (info.allFixed) {
      usedWords.add(getWordFromCols(grid, info.row, info.accessibleCols).toLowerCase());
    }
  }

  for (const info of rowInfos) {
    if (info.allFixed) continue;

    const candidates = getCandidatesForRow(grid, info, usedWords);
    if (candidates.length === 0) return false;

    const word = candidates[Math.floor(Math.random() * candidates.length)];
    fillRow(grid, info, word);
    usedWords.add(word.toLowerCase());
  }

  return true;
}

function getCandidatesForRow(
  grid: Grid,
  info: RowInfo,
  usedWords: Set<string>,
): string[] {
  const { row, accessibleCols, wordLength } = info;

  const positionConstraints = new Map<number, string>();
  for (let i = 0; i < accessibleCols.length; i++) {
    const col = accessibleCols[i];
    const cell = grid.cells[row][col];

    if (cell.fixed && cell.letter) {
      positionConstraints.set(i, cell.letter.toLowerCase());
      continue;
    }

    if (cell.ruleTile?.type === 'hardMatch') {
      const { pairedRow, pairedCol } = cell.ruleTile.constraint;
      const pairedCell = grid.cells[pairedRow]?.[pairedCol];
      if (pairedCell?.letter) {
        positionConstraints.set(i, pairedCell.letter.toLowerCase());
      }
    }
  }

  const mustContain: string[] = [];
  const mustNotContain = new Set<string>();

  for (let sourceRow = 0; sourceRow < grid.rows; sourceRow++) {
    if (!isRowFilled(grid, sourceRow)) continue;
    for (let col = 0; col < grid.cols; col++) {
      const cell = grid.cells[sourceRow][col];
      if (!cell.accessible || !cell.letter || !cell.ruleTile) continue;

      if (cell.ruleTile.type === 'softMatch' && softForbiddenTargetRows(cell.ruleTile.constraint).includes(row)) {
        mustContain.push(cell.letter.toLowerCase());
      } else if (
        cell.ruleTile.type === 'forbiddenMatch' &&
        softForbiddenTargetRows(cell.ruleTile.constraint).includes(row)
      ) {
        mustNotContain.add(cell.letter.toLowerCase());
      }
    }
  }

  const forwardSoftAllowedByPos = new Map<number, Set<string>>();
  for (let i = 0; i < accessibleCols.length; i++) {
    const col = accessibleCols[i];
    const cell = grid.cells[row][col];
    if (cell.ruleTile?.type !== 'softMatch') continue;

    const constraint = cell.ruleTile.constraint;
    const letterSets: Set<string>[] = [];
    if (constraint.nextRow !== undefined && isRowFilled(grid, constraint.nextRow)) {
      const letters = new Set<string>();
      for (let c = 0; c < grid.cols; c++) {
        const t = grid.cells[constraint.nextRow][c];
        if (t.accessible && t.letter) {
          letters.add(t.letter.toLowerCase());
        }
      }
      if (letters.size > 0) letterSets.push(letters);
    }
    if (constraint.prevRow !== undefined && isRowFilled(grid, constraint.prevRow)) {
      const letters = new Set<string>();
      for (let c = 0; c < grid.cols; c++) {
        const t = grid.cells[constraint.prevRow][c];
        if (t.accessible && t.letter) {
          letters.add(t.letter.toLowerCase());
        }
      }
      if (letters.size > 0) letterSets.push(letters);
    }
    if (letterSets.length === 0) continue;

    let allowed = letterSets[0];
    for (let k = 1; k < letterSets.length; k++) {
      allowed = new Set([...allowed].filter(x => letterSets[k].has(x)));
    }
    if (allowed.size > 0) {
      forwardSoftAllowedByPos.set(i, allowed);
    }
  }

  const hasConstraints =
    positionConstraints.size > 0 ||
    mustContain.length > 0 ||
    mustNotContain.size > 0 ||
    forwardSoftAllowedByPos.size > 0;

  let words: string[];
  if (!hasConstraints && usedWords.size === 0) {
    words = generatorDictionary.getWordsOfLength(wordLength);
  } else if (!hasConstraints) {
    words = generatorDictionary.getWordsOfLength(wordLength).filter(w => !usedWords.has(w));
  } else {
    const query: ConstraintQuery = {
      positionConstraints: positionConstraints.size > 0 ? positionConstraints : undefined,
      mustContain: mustContain.length > 0 ? mustContain : undefined,
      mustNotContain: mustNotContain.size > 0 ? mustNotContain : undefined,
      excludeWords: usedWords.size > 0 ? usedWords : undefined,
    };
    words = generatorDictionary.getWordsMatchingConstraints(wordLength, query);
  }

  if (forwardSoftAllowedByPos.size > 0) {
    words = words.filter(word => {
      for (const [pos, allowed] of forwardSoftAllowedByPos) {
        if (!allowed.has(word[pos])) return false;
      }
      return true;
    });
  }

  const colToHardMatchLetter = new Map<number, string>();
  for (const [i, letter] of positionConstraints) {
    colToHardMatchLetter.set(accessibleCols[i], letter);
  }

  const positionForbiddenLetters = new Map<number, Set<string>>();
  const targetRow = row;
  for (let i = 0; i < accessibleCols.length; i++) {
    const col = accessibleCols[i];
    const cell = grid.cells[targetRow][col];
    if (cell.ruleTile?.type !== 'forbiddenMatch') continue;

    const requiredUnion = new Set<string>();
    for (const destRow of softForbiddenTargetRows(cell.ruleTile.constraint)) {
      const destRowCells = grid.cells[destRow];
      if (!destRowCells) continue;

      const requiredInDest = new Set<string>();

      if (isRowFilled(grid, destRow)) {
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
          } else if (destCell.ruleTile?.type === 'hardMatch') {
            const { pairedRow, pairedCol } = destCell.ruleTile.constraint;
            const pairedCell = grid.cells[pairedRow]?.[pairedCol];
            if (pairedCell?.letter) {
              requiredInDest.add(pairedCell.letter.toLowerCase());
            } else if (pairedRow === targetRow) {
              const required = colToHardMatchLetter.get(pairedCol);
              if (required) requiredInDest.add(required);
            }
          }
        }

        for (let sourceRow = 0; sourceRow < grid.rows; sourceRow++) {
          if (!isRowFilled(grid, sourceRow)) continue;
          for (let sourceCol = 0; sourceCol < grid.cols; sourceCol++) {
            const sourceCell = grid.cells[sourceRow][sourceCol];
            const sc = sourceCell.ruleTile?.type === 'softMatch' ? sourceCell.ruleTile.constraint : null;
            if (
              sourceCell.accessible &&
              sc &&
              softForbiddenTargetRows(sc).includes(destRow) &&
              sourceCell.letter
            ) {
              requiredInDest.add(sourceCell.letter.toLowerCase());
            }
          }
        }
      }

      for (const letter of requiredInDest) {
        requiredUnion.add(letter);
      }
    }

    if (requiredUnion.size > 0) {
      positionForbiddenLetters.set(i, requiredUnion);
    }
  }

  if (positionForbiddenLetters.size > 0) {
    words = words.filter(word => {
      for (const [pos, forbidden] of positionForbiddenLetters) {
        if (forbidden.has(word[pos])) return false;
      }
      return true;
    });
  }

  return words;
}

function isRowFilled(grid: Grid, row: number): boolean {
  for (let col = 0; col < grid.cols; col++) {
    const cell = grid.cells[row][col];
    if (cell.accessible && !cell.letter) return false;
  }
  return true;
}

function fillRow(grid: Grid, info: RowInfo, word: string): void {
  for (let i = 0; i < info.accessibleCols.length; i++) {
    const col = info.accessibleCols[i];
    const cell = grid.cells[info.row][col];
    cell.letter = word[i].toUpperCase();
    cell.state = 'filled';
  }
}

// --- Solve-from-here (debug) ---

export interface SolveFromHereResult {
  successRate: number;
  solution: Grid | null;
}

/**
 * Like getRowInfo but treats any row where every accessible cell already has a
 * letter (player-filled or fixed) as "allFixed", so the solver skips it.
 */
function getRowInfoForSolve(grid: Grid): RowInfo[] {
  const rows: RowInfo[] = [];
  for (let row = 0; row < grid.rows; row++) {
    const accessibleCols: number[] = [];
    for (let col = 0; col < grid.cols; col++) {
      if (grid.cells[row][col].accessible) {
        accessibleCols.push(col);
      }
    }
    if (accessibleCols.length === 0) continue;

    const allFixed = accessibleCols.every(c => {
      const cell = grid.cells[row][c];
      return cell.fixed || (cell.letter !== null && cell.letter !== '');
    });
    rows.push({ row, accessibleCols, wordLength: accessibleCols.length, allFixed });
  }
  return rows;
}

function simulateTrialFromHere(originalGrid: Grid): Grid | null {
  const grid = cloneGrid(originalGrid);
  const rowInfos = getRowInfoForSolve(grid);

  const usedWords = new Set<string>();
  for (const info of rowInfos) {
    if (info.allFixed) {
      usedWords.add(getWordFromCols(grid, info.row, info.accessibleCols).toLowerCase());
    }
  }

  for (const info of rowInfos) {
    if (info.allFixed) continue;

    const candidates = getCandidatesForRow(grid, info, usedWords);
    if (candidates.length === 0) return null;

    const word = candidates[Math.floor(Math.random() * candidates.length)];
    fillRow(grid, info, word);
    usedWords.add(word.toLowerCase());
  }

  return grid;
}

export function solveFromHere(grid: Grid, trials: number = 1000): SolveFromHereResult {
  const successfulGrids: Grid[] = [];
  for (let i = 0; i < trials; i++) {
    const result = simulateTrialFromHere(grid);
    if (result) successfulGrids.push(result);
  }
  const successRate = successfulGrids.length / trials;
  const solution = successfulGrids.length > 0
    ? successfulGrids[Math.floor(Math.random() * successfulGrids.length)]
    : null;
  return { successRate, solution };
}
