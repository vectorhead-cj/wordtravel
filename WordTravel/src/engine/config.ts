import { Difficulty } from './types';

export interface GenerationProfile {
  hardMatchPairs: number;
  hardMatchMaxChainLength: number;
  softMatchTiles: number;
  forbiddenTiles: number;
  fixedTiles: number;
  minRuleTilesPerWord: number;
  minCandidatesPerRow: number;
  maxConsecutiveSameLength: number;
  minForbiddenGroupSize: number;
}

export const GENERATION_PROFILES: Record<Difficulty, GenerationProfile> = {
  easy: {
    hardMatchPairs: 2,
    hardMatchMaxChainLength: 2,
    softMatchTiles: 2,
    forbiddenTiles: 0,
    fixedTiles: 3,
    minRuleTilesPerWord: 1,
    minCandidatesPerRow: 20,
    maxConsecutiveSameLength: 3,
    minForbiddenGroupSize: 2,
  },
  medium: {
    hardMatchPairs: 4,
    hardMatchMaxChainLength: 2,
    softMatchTiles: 4,
    forbiddenTiles: 2,
    fixedTiles: 3,
    minRuleTilesPerWord: 1,
    minCandidatesPerRow: 5,
    maxConsecutiveSameLength: 3,
    minForbiddenGroupSize: 2,
  },
  hard: {
    hardMatchPairs: 4,
    hardMatchMaxChainLength: 3,
    softMatchTiles: 3,
    forbiddenTiles: 2,
    fixedTiles: 2,
    minRuleTilesPerWord: 1,
    minCandidatesPerRow: 1,
    maxConsecutiveSameLength: 2,
    minForbiddenGroupSize: 2,
  },
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
  DIFFICULTY_THRESHOLDS: { easy: 0.50, medium: 0.2, hard: 0.02 } as { easy: number; medium: number; hard: number },
} as const;

