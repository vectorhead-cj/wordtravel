export type GameMode = 'puzzle' | 'action';

export type CellState = 'empty' | 'filled' | 'locked';
export type ValidationState = 'none' | 'correct' | 'incorrect';

export interface RuleTile {
  type: string;
  constraint: any;
}

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

