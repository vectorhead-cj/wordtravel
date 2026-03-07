export const PUZZLE_CONFIG = {
  WORD_ROWS: 7,
  WORD_LENGTH_WEIGHTS: { 3: 40, 4: 40, 5: 20 } as Record<number, number>,
  GRID_COLS: 9,
  CENTER_COL: 4,
  MIN_RULE_TILES_PER_WORD: 1,
} as const;

