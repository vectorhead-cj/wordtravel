import { playerDictionary, generatorDictionary } from './Dictionary';

describe('Dictionary', () => {
  describe('playerDictionary', () => {
    describe('initialization', () => {
      it('should load words for all lengths', () => {
        expect(playerDictionary.getWordCount(3)).toBeGreaterThan(0);
        expect(playerDictionary.getWordCount(4)).toBeGreaterThan(0);
        expect(playerDictionary.getWordCount(5)).toBeGreaterThan(0);
        expect(playerDictionary.getWordCount(6)).toBeGreaterThan(0);
      });

      it('should return available lengths', () => {
        const lengths = playerDictionary.getAvailableLengths();
        expect(lengths).toEqual([3, 4, 5, 6]);
      });
    });

    describe('isValidWord', () => {
      it('should validate 3-letter words', () => {
        expect(playerDictionary.isValidWord('cat')).toBe(true);
        expect(playerDictionary.isValidWord('dog')).toBe(true);
        expect(playerDictionary.isValidWord('run')).toBe(true);
      });

      it('should validate 4-letter words', () => {
        expect(playerDictionary.isValidWord('word')).toBe(true);
        expect(playerDictionary.isValidWord('game')).toBe(true);
        expect(playerDictionary.isValidWord('play')).toBe(true);
      });

      it('should validate 5-letter words', () => {
        expect(playerDictionary.isValidWord('hello')).toBe(true);
        expect(playerDictionary.isValidWord('world')).toBe(true);
        expect(playerDictionary.isValidWord('think')).toBe(true);
      });

      it('should validate 6-letter words', () => {
        expect(playerDictionary.isValidWord('puzzle')).toBe(true);
        expect(playerDictionary.isValidWord('friend')).toBe(true);
        expect(playerDictionary.isValidWord('letter')).toBe(true);
      });

      it('should be case insensitive', () => {
        expect(playerDictionary.isValidWord('CAT')).toBe(true);
        expect(playerDictionary.isValidWord('Cat')).toBe(true);
        expect(playerDictionary.isValidWord('cAt')).toBe(true);
      });

      it('should reject invalid words', () => {
        expect(playerDictionary.isValidWord('xyz')).toBe(false);
        expect(playerDictionary.isValidWord('zzzz')).toBe(false);
        expect(playerDictionary.isValidWord('notaword')).toBe(false);
      });

      it('should reject empty string', () => {
        expect(playerDictionary.isValidWord('')).toBe(false);
      });

      it('should reject words with wrong length', () => {
        expect(playerDictionary.isValidWord('ca')).toBe(false);
        expect(playerDictionary.isValidWord('verylongword')).toBe(false);
      });
    });

    describe('getRandomWord', () => {
      it('should return a random 3-letter word', () => {
        const word = playerDictionary.getRandomWord(3);
        expect(word).not.toBeNull();
        expect(word?.length).toBe(3);
        expect(playerDictionary.isValidWord(word!)).toBe(true);
      });

      it('should return a random 4-letter word', () => {
        const word = playerDictionary.getRandomWord(4);
        expect(word).not.toBeNull();
        expect(word?.length).toBe(4);
        expect(playerDictionary.isValidWord(word!)).toBe(true);
      });

      it('should return a random 5-letter word', () => {
        const word = playerDictionary.getRandomWord(5);
        expect(word).not.toBeNull();
        expect(word?.length).toBe(5);
        expect(playerDictionary.isValidWord(word!)).toBe(true);
      });

      it('should return a random 6-letter word', () => {
        const word = playerDictionary.getRandomWord(6);
        expect(word).not.toBeNull();
        expect(word?.length).toBe(6);
        expect(playerDictionary.isValidWord(word!)).toBe(true);
      });

      it('should return null for unsupported length', () => {
        expect(playerDictionary.getRandomWord(2)).toBeNull();
        expect(playerDictionary.getRandomWord(7)).toBeNull();
        expect(playerDictionary.getRandomWord(10)).toBeNull();
      });

      it('should return different words on multiple calls', () => {
        const words = new Set();
        for (let i = 0; i < 10; i++) {
          words.add(playerDictionary.getRandomWord(3));
        }
        expect(words.size).toBeGreaterThan(1);
      });
    });

    describe('getWordsMatchingConstraints', () => {
      it('should filter by position constraints', () => {
        const results = playerDictionary.getWordsMatchingConstraints(3, {
          positionConstraints: new Map([[0, 'c'], [1, 'a'], [2, 't']]),
        });
        expect(results).toEqual(['cat']);
      });

      it('should filter by single position constraint', () => {
        const results = playerDictionary.getWordsMatchingConstraints(3, {
          positionConstraints: new Map([[0, 'c']]),
        });
        expect(results.length).toBeGreaterThan(1);
        expect(results.every(w => w[0] === 'c')).toBe(true);
      });

      it('should intersect multiple position constraints', () => {
        const results = playerDictionary.getWordsMatchingConstraints(4, {
          positionConstraints: new Map([[0, 'w'], [3, 'd']]),
        });
        expect(results.length).toBeGreaterThan(0);
        expect(results.every(w => w[0] === 'w' && w[3] === 'd')).toBe(true);
        expect(results).toContain('word');
      });

      it('should filter by mustContain', () => {
        const results = playerDictionary.getWordsMatchingConstraints(3, {
          mustContain: ['x'],
        });
        expect(results.length).toBeGreaterThan(0);
        expect(results.every(w => w.includes('x'))).toBe(true);
      });

      it('should filter by mustNotContain', () => {
        const results = playerDictionary.getWordsMatchingConstraints(3, {
          mustNotContain: new Set(['a', 'e', 'i', 'o', 'u']),
        });
        expect(results.length).toBeGreaterThan(0);
        expect(results.every(w => !/[aeiou]/.test(w))).toBe(true);
      });

      it('should exclude specific words', () => {
        const all = playerDictionary.getWordsMatchingConstraints(3, {
          positionConstraints: new Map([[0, 'c'], [1, 'a'], [2, 't']]),
        });
        expect(all).toEqual(['cat']);

        const excluded = playerDictionary.getWordsMatchingConstraints(3, {
          positionConstraints: new Map([[0, 'c'], [1, 'a'], [2, 't']]),
          excludeWords: new Set(['cat']),
        });
        expect(excluded).toEqual([]);
      });

      it('should combine position, mustContain, and mustNotContain', () => {
        const results = playerDictionary.getWordsMatchingConstraints(4, {
          positionConstraints: new Map([[0, 'w']]),
          mustContain: ['r'],
          mustNotContain: new Set(['z']),
        });
        expect(results.length).toBeGreaterThan(0);
        expect(results.every(w => w[0] === 'w' && w.includes('r') && !w.includes('z'))).toBe(true);
      });

      it('should return empty for impossible constraints', () => {
        const results = playerDictionary.getWordsMatchingConstraints(3, {
          positionConstraints: new Map([[0, 'z'], [1, 'z'], [2, 'z']]),
        });
        expect(results).toEqual([]);
      });

      it('should return all words when no constraints given', () => {
        const results = playerDictionary.getWordsMatchingConstraints(3, {});
        expect(results.length).toBe(playerDictionary.getWordCount(3));
      });
    });
  });

  describe('generatorDictionary', () => {
    it('should contain fewer words than playerDictionary due to frequency threshold', () => {
      expect(generatorDictionary.getWordCount(3)).toBeLessThan(playerDictionary.getWordCount(3));
      expect(generatorDictionary.getWordCount(4)).toBeLessThan(playerDictionary.getWordCount(4));
      expect(generatorDictionary.getWordCount(5)).toBeLessThan(playerDictionary.getWordCount(5));
      expect(generatorDictionary.getWordCount(6)).toBeLessThan(playerDictionary.getWordCount(6));
    });

    it('should still contain common words', () => {
      expect(generatorDictionary.isValidWord('cat')).toBe(true);
      expect(generatorDictionary.isValidWord('word')).toBe(true);
      expect(generatorDictionary.isValidWord('think')).toBe(true);
    });

    it('should load all four word lengths', () => {
      const lengths = generatorDictionary.getAvailableLengths();
      expect(lengths).toEqual([3, 4, 5, 6]);
    });
  });
});
