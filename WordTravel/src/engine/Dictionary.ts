class Dictionary {
  private words: Set<string>;

  constructor() {
    this.words = new Set();
    this.initializeTestWords();
  }

  private initializeTestWords() {
    for (let i = 0; i < 26; i++) {
      const letter = String.fromCharCode(97 + i);
      for (let length = 3; length <= 6; length++) {
        this.words.add(letter.repeat(length));
      }
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

