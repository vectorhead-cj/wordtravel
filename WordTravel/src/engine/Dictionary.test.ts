import { dictionary } from './Dictionary';

describe('Dictionary', () => {
  beforeAll(() => {
    dictionary.initialize();
  });

  describe('initialization', () => {
    it('should load words for all lengths', () => {
      expect(dictionary.getWordCount(3)).toBeGreaterThan(0);
      expect(dictionary.getWordCount(4)).toBeGreaterThan(0);
      expect(dictionary.getWordCount(5)).toBeGreaterThan(0);
      expect(dictionary.getWordCount(6)).toBeGreaterThan(0);
    });

    it('should return available lengths', () => {
      const lengths = dictionary.getAvailableLengths();
      expect(lengths).toEqual([3, 4, 5, 6]);
    });
  });

  describe('isValidWord', () => {
    it('should validate 3-letter words', () => {
      expect(dictionary.isValidWord('cat')).toBe(true);
      expect(dictionary.isValidWord('dog')).toBe(true);
      expect(dictionary.isValidWord('run')).toBe(true);
    });

    it('should validate 4-letter words', () => {
      expect(dictionary.isValidWord('word')).toBe(true);
      expect(dictionary.isValidWord('game')).toBe(true);
      expect(dictionary.isValidWord('play')).toBe(true);
    });

    it('should validate 5-letter words', () => {
      expect(dictionary.isValidWord('hello')).toBe(true);
      expect(dictionary.isValidWord('world')).toBe(true);
      expect(dictionary.isValidWord('think')).toBe(true);
    });

    it('should validate 6-letter words', () => {
      expect(dictionary.isValidWord('puzzle')).toBe(true);
      expect(dictionary.isValidWord('friend')).toBe(true);
      expect(dictionary.isValidWord('letter')).toBe(true);
    });

    it('should be case insensitive', () => {
      expect(dictionary.isValidWord('CAT')).toBe(true);
      expect(dictionary.isValidWord('Cat')).toBe(true);
      expect(dictionary.isValidWord('cAt')).toBe(true);
    });

    it('should reject invalid words', () => {
      expect(dictionary.isValidWord('xyz')).toBe(false);
      expect(dictionary.isValidWord('zzzz')).toBe(false);
      expect(dictionary.isValidWord('notaword')).toBe(false);
    });

    it('should reject empty string', () => {
      expect(dictionary.isValidWord('')).toBe(false);
    });

    it('should reject words with wrong length', () => {
      expect(dictionary.isValidWord('ca')).toBe(false);
      expect(dictionary.isValidWord('verylongword')).toBe(false);
    });
  });

  describe('getRandomWord', () => {
    it('should return a random 3-letter word', () => {
      const word = dictionary.getRandomWord(3);
      expect(word).not.toBeNull();
      expect(word?.length).toBe(3);
      expect(dictionary.isValidWord(word!)).toBe(true);
    });

    it('should return a random 4-letter word', () => {
      const word = dictionary.getRandomWord(4);
      expect(word).not.toBeNull();
      expect(word?.length).toBe(4);
      expect(dictionary.isValidWord(word!)).toBe(true);
    });

    it('should return a random 5-letter word', () => {
      const word = dictionary.getRandomWord(5);
      expect(word).not.toBeNull();
      expect(word?.length).toBe(5);
      expect(dictionary.isValidWord(word!)).toBe(true);
    });

    it('should return a random 6-letter word', () => {
      const word = dictionary.getRandomWord(6);
      expect(word).not.toBeNull();
      expect(word?.length).toBe(6);
      expect(dictionary.isValidWord(word!)).toBe(true);
    });

    it('should return null for unsupported length', () => {
      expect(dictionary.getRandomWord(2)).toBeNull();
      expect(dictionary.getRandomWord(7)).toBeNull();
      expect(dictionary.getRandomWord(10)).toBeNull();
    });

    it('should return different words on multiple calls', () => {
      const words = new Set();
      for (let i = 0; i < 10; i++) {
        words.add(dictionary.getRandomWord(3));
      }
      expect(words.size).toBeGreaterThan(1);
    });
  });

  describe('getWordsMatchingConstraints', () => {
    it('should filter by position constraints', () => {
      const results = dictionary.getWordsMatchingConstraints(3, {
        positionConstraints: new Map([[0, 'c'], [1, 'a'], [2, 't']]),
      });
      expect(results).toEqual(['cat']);
    });

    it('should filter by single position constraint', () => {
      const results = dictionary.getWordsMatchingConstraints(3, {
        positionConstraints: new Map([[0, 'c']]),
      });
      expect(results.length).toBeGreaterThan(1);
      expect(results.every(w => w[0] === 'c')).toBe(true);
    });

    it('should intersect multiple position constraints', () => {
      const results = dictionary.getWordsMatchingConstraints(4, {
        positionConstraints: new Map([[0, 'w'], [3, 'd']]),
      });
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(w => w[0] === 'w' && w[3] === 'd')).toBe(true);
      expect(results).toContain('word');
    });

    it('should filter by mustContain', () => {
      const results = dictionary.getWordsMatchingConstraints(3, {
        mustContain: ['x'],
      });
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(w => w.includes('x'))).toBe(true);
    });

    it('should filter by mustNotContain', () => {
      const results = dictionary.getWordsMatchingConstraints(3, {
        mustNotContain: new Set(['a', 'e', 'i', 'o', 'u']),
      });
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(w => !/[aeiou]/.test(w))).toBe(true);
    });

    it('should exclude specific words', () => {
      const all = dictionary.getWordsMatchingConstraints(3, {
        positionConstraints: new Map([[0, 'c'], [1, 'a'], [2, 't']]),
      });
      expect(all).toEqual(['cat']);

      const excluded = dictionary.getWordsMatchingConstraints(3, {
        positionConstraints: new Map([[0, 'c'], [1, 'a'], [2, 't']]),
        excludeWords: new Set(['cat']),
      });
      expect(excluded).toEqual([]);
    });

    it('should combine position, mustContain, and mustNotContain', () => {
      const results = dictionary.getWordsMatchingConstraints(4, {
        positionConstraints: new Map([[0, 'w']]),
        mustContain: ['r'],
        mustNotContain: new Set(['z']),
      });
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(w => w[0] === 'w' && w.includes('r') && !w.includes('z'))).toBe(true);
    });

    it('should return empty for impossible constraints', () => {
      const results = dictionary.getWordsMatchingConstraints(3, {
        positionConstraints: new Map([[0, 'z'], [1, 'z'], [2, 'z']]),
      });
      expect(results).toEqual([]);
    });

    it('should return all words when no constraints given', () => {
      const results = dictionary.getWordsMatchingConstraints(3, {});
      expect(results.length).toBe(dictionary.getWordCount(3));
    });
  });
});
