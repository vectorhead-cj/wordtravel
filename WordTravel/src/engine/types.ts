export type GameMode = 'puzzle' | 'action';

export type CellState = 'empty' | 'filled' | 'locked';

export interface Cell {
  letter: string | null;
  state: CellState;
  isCorrect?: boolean;
}

export interface Grid {
  rows: number;
  cols: number;
  cells: Cell[][];
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

