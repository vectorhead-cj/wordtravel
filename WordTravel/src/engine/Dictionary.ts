import words3Raw from '../data/words_en_3';
import words4Raw from '../data/words_en_4';
import words5Raw from '../data/words_en_5';
import words6Raw from '../data/words_en_6';

class Dictionary {
  private wordsByLength: Map<number, Set<string>>;
  private isInitialized: boolean = false;

  constructor() {
    this.wordsByLength = new Map();
  }

  initialize(): void {
    if (this.isInitialized) return;

    this.loadWords(3, words3Raw);
    this.loadWords(4, words4Raw);
    this.loadWords(5, words5Raw);
    this.loadWords(6, words6Raw);

    this.isInitialized = true;
  }

  private loadWords(length: number, wordList: string): void {
    const words = wordList
      .trim()
      .split('\n')
      .map(w => w.trim().toLowerCase())
      .filter(w => w.length > 0 && w.length === length);

    this.wordsByLength.set(length, new Set(words));
  }

  isValidWord(word: string): boolean {
    const normalizedWord = word.toLowerCase();
    const length = normalizedWord.length;

    const wordSet = this.wordsByLength.get(length);
    return wordSet?.has(normalizedWord) ?? false;
  }

  getRandomWord(length: number): string | null {
    const wordSet = this.wordsByLength.get(length);
    if (!wordSet || wordSet.size === 0) return null;

    const words = Array.from(wordSet);
    return words[Math.floor(Math.random() * words.length)];
  }

  getWordCount(length?: number): number {
    if (length !== undefined) {
      return this.wordsByLength.get(length)?.size ?? 0;
    }

    let total = 0;
    for (const wordSet of this.wordsByLength.values()) {
      total += wordSet.size;
    }
    return total;
  }

  getWordsOfLength(length: number): string[] {
    const wordSet = this.wordsByLength.get(length);
    if (!wordSet) return [];
    return Array.from(wordSet);
  }

  getAvailableLengths(): number[] {
    return Array.from(this.wordsByLength.keys()).sort((a, b) => a - b);
  }
}

export const dictionary = new Dictionary();

