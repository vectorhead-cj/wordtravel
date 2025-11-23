class Dictionary {
  private words: Set<string>;

  constructor() {
    this.words = new Set();
    this.initializeTestWords();
  }

  private initializeTestWords() {
    for (let i = 0; i < 26; i++) {
      const letter = String.fromCharCode(97 + i);
      this.words.add(letter.repeat(5));
    }
  }

  isValidWord(word: string): boolean {
    return this.words.has(word.toLowerCase());
  }

  getWordCount(): number {
    return this.words.size;
  }
}

export const dictionary = new Dictionary();

