export type GameMode = 'puzzle' | 'action';

export type CellState = 'empty' | 'filled' | 'locked';
export type ValidationState = 'none' | 'correct' | 'incorrect';

export interface HardMatchTile {
  type: 'hardMatch';
  constraint: {
    pairedRow: number;
    pairedCol: number;
    position: 'top' | 'bottom';
  };
}

export interface SoftMatchTile {
  type: 'softMatch';
  constraint: {
    nextRow: number;
  };
}

export interface ForbiddenMatchTile {
  type: 'forbiddenMatch';
  constraint: {
    nextRow: number;
  };
}

export type RuleTile = HardMatchTile | SoftMatchTile | ForbiddenMatchTile;

export interface Cell {
  letter: string | null;
  state: CellState;
  accessible: boolean;
  validation: ValidationState;
  ruleTile?: RuleTile;
}

export interface WordSlot {
  row: number;
  length: number;
  startCol: number;
  endCol: number;
}

export interface PuzzleConfig {
  wordSlots: WordSlot[];
  rows: number;
  cols: number;
}

export interface Grid {
  rows: number;
  cols: number;
  cells: Cell[][];
}

export function cloneGrid(grid: Grid): Grid {
  return {
    ...grid,
    cells: grid.cells.map(row =>
      row.map(cell => ({
        ...cell,
        ruleTile: cell.ruleTile ? { ...cell.ruleTile, constraint: { ...cell.ruleTile.constraint } } : undefined,
      }))
    ),
  };
}

export interface GameState {
  mode: GameMode;
  grid: Grid;
  score: number;
  isComplete: boolean;
  isSuccess: boolean;
}

export interface GameResult {
  success: boolean;
  score: number;
  timeElapsed?: number;
}

