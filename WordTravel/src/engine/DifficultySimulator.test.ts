import { simulatePuzzleDifficulty, classifyDifficulty } from './DifficultySimulator';
import { PuzzleGenerator } from './PuzzleGenerator';
import { parseGrid } from './PuzzleNotation';
import { generatorDictionary, playerDictionary } from './Dictionary';

describe('DifficultySimulator', () => {
  beforeAll(() => {
    generatorDictionary.initialize();
  });

  describe('classifyDifficulty', () => {
    it('should classify high success rate as easy', () => {
      expect(classifyDifficulty(0.9)).toBe('easy');
      expect(classifyDifficulty(0.95)).toBe('easy');
    });

    it('should classify medium success rate as medium', () => {
      expect(classifyDifficulty(0.6)).toBe('medium');
      expect(classifyDifficulty(0.65)).toBe('medium');
    });

    it('should classify low success rate as hard', () => {
      expect(classifyDifficulty(0.1)).toBe('hard');
      expect(classifyDifficulty(0.15)).toBe('hard');
    });

    it('should reject puzzles below the hard threshold', () => {
      expect(classifyDifficulty(0.01)).toBeNull();
      expect(classifyDifficulty(0.0)).toBeNull();
    });
  });

  describe('simulatePuzzleDifficulty', () => {
    it('should return a valid SimulationResult', () => {
      const gen = new PuzzleGenerator();
      const { puzzle } = gen.generatePuzzle('bridge');
      const grid = parseGrid(puzzle);

      const result = simulatePuzzleDifficulty(grid, 20);

      expect(result.trials).toBe(20);
      expect(result.successRate).toBeGreaterThanOrEqual(0);
      expect(result.successRate).toBeLessThanOrEqual(1);
      expect(['easy', 'medium', 'hard', null]).toContain(result.difficulty);
    });

    it('should produce consistent classification across runs', () => {
      const gen = new PuzzleGenerator();
      const { puzzle } = gen.generatePuzzle('bridge');
      const grid = parseGrid(puzzle);

      const results = Array.from({ length: 5 }, () =>
        simulatePuzzleDifficulty(grid, 50),
      );

      const difficulties = new Set(results.map(r => r.difficulty));
      // With 50 trials repeated 5 times on the same puzzle, we expect
      // at most 2 distinct classifications (borderline puzzles may wobble)
      expect(difficulties.size).toBeLessThanOrEqual(2);
    });

    it('should return successRate of 0 or more for open puzzles', () => {
      const gen = new PuzzleGenerator();
      const { puzzle } = gen.generatePuzzle('open');
      const grid = parseGrid(puzzle);

      const result = simulatePuzzleDifficulty(grid, 20);
      expect(result.successRate).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('Dictionary letterIndex', () => {
  describe('mustContain-only queries use the letter index', () => {
    it('should return words containing a specific letter', () => {
      const results = generatorDictionary.getWordsMatchingConstraints(4, {
        mustContain: ['x'],
      });
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(w => w.includes('x'))).toBe(true);
    });

    it('should intersect multiple mustContain letters', () => {
      const results = generatorDictionary.getWordsMatchingConstraints(4, {
        mustContain: ['a', 'e'],
      });
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(w => w.includes('a') && w.includes('e'))).toBe(true);
    });

    it('should match results from full-scan path', () => {
      const withLetterIndex = playerDictionary.getWordsMatchingConstraints(4, {
        mustContain: ['z'],
      });
      const fullScan = playerDictionary.getWordsOfLength(4)
        .filter(w => w.includes('z'));

      expect(withLetterIndex.sort()).toEqual(fullScan.sort());
    });

    it('should combine mustContain and mustNotContain without position constraints', () => {
      const results = generatorDictionary.getWordsMatchingConstraints(4, {
        mustContain: ['a'],
        mustNotContain: new Set(['e']),
      });
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(w => w.includes('a') && !w.includes('e'))).toBe(true);
    });
  });
});
