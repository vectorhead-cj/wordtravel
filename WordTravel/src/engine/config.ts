import { Difficulty } from './types';

export interface GenerationProfile {
  minHardMatchPairs: number;
  hardMatchMaxChainLength: number;
  minSoftMatchModifiers: number;
  minForbiddenModifiers: number;
  fixedTiles: number;
  minModifiersPerRow: number;
  minCandidatesPerRow: number;
  maxConsecutiveSameLength: number;
  minForbiddenGroupSize: number;
  maxRulesPerCell: number;
  permittedSoftAndForbiddenDirections: 'down' | 'bidirectional';
  fixedWordRowsMayHaveNonHardModifiers: boolean;
}

export const GENERATION_PROFILES: Record<Difficulty, GenerationProfile> = {
  easy: {
    minHardMatchPairs: 2,
    hardMatchMaxChainLength: 2,
    minSoftMatchModifiers: 2,
    minForbiddenModifiers: 1,
    fixedTiles: 3,
    minModifiersPerRow: 1,
    minCandidatesPerRow: 20,
    maxConsecutiveSameLength: 3,
    minForbiddenGroupSize: 2,
    maxRulesPerCell: 1,
    permittedSoftAndForbiddenDirections: 'down',
    fixedWordRowsMayHaveNonHardModifiers: false,
  },
  medium: {
    minHardMatchPairs: 4,
    hardMatchMaxChainLength: 2,
    minSoftMatchModifiers: 4,
    minForbiddenModifiers: 2,
    fixedTiles: 3,
    minModifiersPerRow: 1,
    minCandidatesPerRow: 5,
    maxConsecutiveSameLength: 3,
    minForbiddenGroupSize: 2,
    maxRulesPerCell: 1,
    permittedSoftAndForbiddenDirections: 'down',
    fixedWordRowsMayHaveNonHardModifiers: false,
  },
  hard: {
    minHardMatchPairs: 4,
    hardMatchMaxChainLength: 3,
    minSoftMatchModifiers: 3,
    minForbiddenModifiers: 2,
    fixedTiles: 2,
    minModifiersPerRow: 1,
    minCandidatesPerRow: 1,
    maxConsecutiveSameLength: 2,
    minForbiddenGroupSize: 2,
    maxRulesPerCell: 2,
    permittedSoftAndForbiddenDirections: 'bidirectional',
    fixedWordRowsMayHaveNonHardModifiers: true,
  },
};

export const PUZZLE_CONFIG = {
  WORD_ROWS: 7,
  WORD_LENGTH_WEIGHTS: { 3: 40, 4: 40, 5: 20 } as Record<number, number>,
  GRID_COLS: 5,
  CENTER_COL: 2,
  FIXED_LETTER_ALPHABET_EXCLUDE: 'JQVXZ',
  // Words with frequency below this threshold are excluded from puzzle generation and hint counting.
  // Raise to restrict to more common words; lower to broaden the generator vocabulary.
  GENERATOR_MIN_WORD_FREQUENCY: 5e-6,

  DIFFICULTY_SIMULATION_TRIALS: 500,
  // successRate >= easy → easy, >= medium → medium, >= hard → hard, else rejected
  DIFFICULTY_THRESHOLDS: { easy: 0.50, medium: 0.2, hard: 0.02 } as { easy: number; medium: number; hard: number },
} as const;

