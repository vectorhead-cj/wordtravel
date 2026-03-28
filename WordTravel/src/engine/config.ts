import { Difficulty } from './types';

export interface GenerationProfile {
  hardMatchPairs: number;
  softMatchTiles: number;
  forbiddenTiles: number;
  fixedTiles: number;
  minRuleTilesPerWord: number;
}

export const GENERATION_PROFILES: Record<Difficulty, GenerationProfile> = {
  easy:   { hardMatchPairs: 2, softMatchTiles: 2, forbiddenTiles: 0, fixedTiles: 3, minRuleTilesPerWord: 1 },
  medium: { hardMatchPairs: 4, softMatchTiles: 4, forbiddenTiles: 2, fixedTiles: 3, minRuleTilesPerWord: 1 },
  hard:   { hardMatchPairs: 5, softMatchTiles: 5, forbiddenTiles: 3, fixedTiles: 2, minRuleTilesPerWord: 1 },
};

export const PUZZLE_CONFIG = {
  WORD_ROWS: 7,
  WORD_LENGTH_WEIGHTS: { 3: 40, 4: 40, 5: 20 } as Record<number, number>,
  GRID_COLS: 5,
  CENTER_COL: 2,
  FIXED_LETTER_ALPHABET: 'ABCDEFGHIKLMNOPRSTUWY',
  // Words with frequency below this threshold are excluded from puzzle generation and hint counting.
  // Raise to restrict to more common words; lower to broaden the generator vocabulary.
  GENERATOR_MIN_WORD_FREQUENCY: 5e-6,

  DIFFICULTY_SIMULATION_TRIALS: 500,
  // successRate >= easy → easy, >= medium → medium, >= hard → hard, else rejected
  DIFFICULTY_THRESHOLDS: { easy: 0.50, medium: 0.25, hard: 0.05 } as { easy: number; medium: number; hard: number },
} as const;

