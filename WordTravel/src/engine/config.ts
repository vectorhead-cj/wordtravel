export const PUZZLE_CONFIG = {
  WORD_ROWS: 7,
  WORD_LENGTH_WEIGHTS: { 3: 40, 4: 40, 5: 20 } as Record<number, number>,
  GRID_COLS: 5,
  CENTER_COL: 2,
  MIN_RULE_TILES_PER_WORD: 1,
  FIXED_TILES_PER_PUZZLE: 3,
  FIXED_LETTER_ALPHABET: 'ABCDEFGHIKLMNOPRSTUWY',
  // Words with frequency below this threshold are excluded from puzzle generation and hint counting.
  // Raise to restrict to more common words; lower to broaden the generator vocabulary.
  GENERATOR_MIN_WORD_FREQUENCY: 5e-6,

  DIFFICULTY_SIMULATION_TRIALS: 500,
  // successRate >= easy → easy, >= medium → medium, >= hard → hard, else rejected
  DIFFICULTY_THRESHOLDS: { easy: 0.80, medium: 0.5, hard: 0.05 } as { easy: number; medium: number; hard: number },
} as const;

