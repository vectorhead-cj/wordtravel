import { Grid } from './types';
import { solveFromHere } from './DifficultySimulator';

const DEFAULT_DELAY_MS = 100;

export class AutoSolver {
  private letterQueue: string[] = [];
  private currentIndex = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private onLetter: (letter: string) => void;
  private delayMs: number;

  constructor(onLetter: (letter: string) => void, delayMs = DEFAULT_DELAY_MS) {
    this.onLetter = onLetter;
    this.delayMs = delayMs;
  }

  start(grid: Grid): boolean {
    this.stop();

    const result = solveFromHere(grid, 1000);
    if (!result.solution) return false;

    this.letterQueue = [];
    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.cols; col++) {
        const original = grid.cells[row][col];
        const solved = result.solution.cells[row][col];
        if (original.accessible && !original.fixed && !original.letter && solved.letter) {
          this.letterQueue.push(solved.letter);
        }
      }
    }

    if (this.letterQueue.length === 0) return false;

    this.currentIndex = 0;
    this.scheduleNext();
    return true;
  }

  stop() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.currentIndex = 0;
    this.letterQueue = [];
  }

  get isRunning(): boolean {
    return this.timer !== null;
  }

  private scheduleNext() {
    if (this.currentIndex >= this.letterQueue.length) {
      this.timer = null;
      return;
    }

    this.timer = setTimeout(() => {
      const letter = this.letterQueue[this.currentIndex];
      this.onLetter(letter);
      this.currentIndex++;
      this.scheduleNext();
    }, this.delayMs);
  }
}
