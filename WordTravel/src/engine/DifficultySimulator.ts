import { Grid, Difficulty, cloneGrid } from './types';
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

      if (cell.ruleTile.type === 'softMatch' && cell.ruleTile.constraint.nextRow === row) {
        mustContain.push(cell.letter.toLowerCase());
      } else if (cell.ruleTile.type === 'forbiddenMatch' && cell.ruleTile.constraint.nextRow === row) {
        mustNotContain.add(cell.letter.toLowerCase());
      }
    }
  }

  const hasConstraints =
    positionConstraints.size > 0 ||
    mustContain.length > 0 ||
    mustNotContain.size > 0;

  if (!hasConstraints && usedWords.size === 0) {
    return generatorDictionary.getWordsOfLength(wordLength);
  }

  if (!hasConstraints) {
    return generatorDictionary.getWordsOfLength(wordLength)
      .filter(w => !usedWords.has(w));
  }

  const query: ConstraintQuery = {
    positionConstraints: positionConstraints.size > 0 ? positionConstraints : undefined,
    mustContain: mustContain.length > 0 ? mustContain : undefined,
    mustNotContain: mustNotContain.size > 0 ? mustNotContain : undefined,
    excludeWords: usedWords.size > 0 ? usedWords : undefined,
  };

  return generatorDictionary.getWordsMatchingConstraints(wordLength, query);
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
