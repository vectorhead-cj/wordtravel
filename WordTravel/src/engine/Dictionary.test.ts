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
});

