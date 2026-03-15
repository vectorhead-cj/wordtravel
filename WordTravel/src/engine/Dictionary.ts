import words3Raw from '../data/words_en_3.txt';
import words4Raw from '../data/words_en_4.txt';
import words5Raw from '../data/words_en_5.txt';
import words6Raw from '../data/words_en_6.txt';
import { PUZZLE_CONFIG } from './config';

export interface ConstraintQuery {
  positionConstraints?: Map<number, string>;
  mustContain?: string[];
  mustNotContain?: Set<string>;
  excludeWords?: Set<string>;
}

interface DictionaryOptions {
  minFrequency?: number;
}

class Dictionary {
  private wordSets: Map<number, Set<string>>;
  private wordArrays: Map<number, string[]>;
  // Key: "length:position:letter" → words matching that constraint
  private positionIndex: Map<string, string[]>;
  // Key: "length:letter" → words containing that letter (any position)
  private letterIndex: Map<string, string[]>;
  private isInitialized: boolean = false;
  private readonly options: DictionaryOptions;

  constructor(options: DictionaryOptions = {}) {
    this.wordSets = new Map();
    this.wordArrays = new Map();
    this.positionIndex = new Map();
    this.letterIndex = new Map();
    this.options = options;
  }

  initialize(): void {
    if (this.isInitialized) return;

    this.loadWords(3, words3Raw);
    this.loadWords(4, words4Raw);
    this.loadWords(5, words5Raw);
    this.loadWords(6, words6Raw);

    this.isInitialized = true;
  }

  private loadWords(length: number, raw: string): void {
    const { minFrequency } = this.options;

    const words = raw
      .trim()
      .split('\n')
      .flatMap(line => {
        const [word, freqStr] = line.trim().split('\t');
        if (!word || word.length !== length) return [];
        if (minFrequency !== undefined) {
          const freq = parseFloat(freqStr);
          if (isNaN(freq) || freq < minFrequency) return [];
        }
        return [word.toLowerCase()];
      });

    this.wordSets.set(length, new Set(words));
    this.wordArrays.set(length, words);

    for (const word of words) {
      for (let pos = 0; pos < word.length; pos++) {
        const key = `${length}:${pos}:${word[pos]}`;
        let bucket = this.positionIndex.get(key);
        if (!bucket) {
          bucket = [];
          this.positionIndex.set(key, bucket);
        }
        bucket.push(word);
      }

      const uniqueLetters = new Set(word);
      for (const letter of uniqueLetters) {
        const key = `${length}:${letter}`;
        let bucket = this.letterIndex.get(key);
        if (!bucket) {
          bucket = [];
          this.letterIndex.set(key, bucket);
        }
        bucket.push(word);
      }
    }
  }

  isValidWord(word: string): boolean {
    const normalized = word.toLowerCase();
    return this.wordSets.get(normalized.length)?.has(normalized) ?? false;
  }

  getRandomWord(length: number): string | null {
    const words = this.wordArrays.get(length);
    if (!words || words.length === 0) return null;
    return words[Math.floor(Math.random() * words.length)];
  }

  getWordCount(length?: number): number {
    if (length !== undefined) {
      return this.wordSets.get(length)?.size ?? 0;
    }
    let total = 0;
    for (const wordSet of this.wordSets.values()) {
      total += wordSet.size;
    }
    return total;
  }

  getWordsOfLength(length: number): string[] {
    return this.wordArrays.get(length) ?? [];
  }

  getAvailableLengths(): number[] {
    return Array.from(this.wordSets.keys()).sort((a, b) => a - b);
  }

  /**
   * Returns words matching all supplied constraints using the position index
   * for fast filtering. Falls back to linear scan for mustContain/mustNotContain
   * since those aren't position-specific.
   */
  getWordsMatchingConstraints(length: number, query: ConstraintQuery): string[] {
    const { positionConstraints, mustContain, mustNotContain, excludeWords } = query;

    let candidates: string[] | null = null;

    // Use position index to narrow candidates via intersection
    if (positionConstraints && positionConstraints.size > 0) {
      for (const [pos, letter] of positionConstraints) {
        const bucket = this.positionIndex.get(`${length}:${pos}:${letter}`) ?? [];
        if (candidates === null) {
          candidates = [...bucket];
        } else {
          const bucketSet = new Set(bucket);
          candidates = candidates.filter(w => bucketSet.has(w));
        }
        if (candidates.length === 0) return [];
      }
    }

    // Use letter index to narrow candidates when only mustContain is available
    if (candidates === null && mustContain && mustContain.length > 0) {
      for (const letter of mustContain) {
        const bucket = this.letterIndex.get(`${length}:${letter}`) ?? [];
        if (candidates === null) {
          candidates = [...bucket];
        } else {
          const bucketSet = new Set(bucket);
          candidates = candidates.filter(w => bucketSet.has(w));
        }
        if (candidates.length === 0) return [];
      }
    }

    if (candidates === null) {
      candidates = [...(this.wordArrays.get(length) ?? [])];
    }

    if (excludeWords && excludeWords.size > 0) {
      candidates = candidates.filter(w => !excludeWords.has(w));
    }

    if (mustNotContain && mustNotContain.size > 0) {
      candidates = candidates.filter(w => {
        for (const letter of mustNotContain) {
          if (w.includes(letter)) return false;
        }
        return true;
      });
    }

    if (mustContain && mustContain.length > 0) {
      candidates = candidates.filter(w =>
        mustContain.every(letter => w.includes(letter)),
      );
    }

    return candidates;
  }
}

export const playerDictionary = new Dictionary();
playerDictionary.initialize();

export const generatorDictionary = new Dictionary({ minFrequency: PUZZLE_CONFIG.GENERATOR_MIN_WORD_FREQUENCY });
generatorDictionary.initialize();
