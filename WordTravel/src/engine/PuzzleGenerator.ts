import { Grid, Cell, PuzzleConfig, WordSlot } from './types';
import { PUZZLE_CONFIG } from './config';

export class PuzzleGenerator {
  generatePuzzleConfig(): PuzzleConfig {
    const wordSlots: WordSlot[] = [];
    
    for (let i = 0; i < PUZZLE_CONFIG.WORD_ROWS; i++) {
      const length = this.randomWordLength();
      const { startCol, endCol } = this.calculateWordPosition(length);
      
      wordSlots.push({
        row: i + 1,
        length,
        startCol,
        endCol,
      });
    }
    
    const totalRows = PUZZLE_CONFIG.WORD_ROWS + 2;
    
    return {
      wordSlots,
      rows: totalRows,
      cols: PUZZLE_CONFIG.GRID_COLS,
    };
  }
  
  createGridFromConfig(config: PuzzleConfig): Grid {
    const cells: Cell[][] = [];
    
    for (let row = 0; row < config.rows; row++) {
      cells[row] = [];
      for (let col = 0; col < config.cols; col++) {
        const wordSlot = config.wordSlots.find(slot => slot.row === row);
        const isAccessible = wordSlot 
          ? col >= wordSlot.startCol && col <= wordSlot.endCol
          : false;
        
        cells[row][col] = {
          letter: null,
          state: 'empty',
          accessible: isAccessible,
          validation: 'none',
        };
      }
    }
    
    return {
      rows: config.rows,
      cols: config.cols,
      cells,
    };
  }
  
  private randomWordLength(): number {
    const min = PUZZLE_CONFIG.MIN_WORD_LENGTH;
    const max = PUZZLE_CONFIG.MAX_WORD_LENGTH;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  
  private calculateWordPosition(length: number): { startCol: number; endCol: number } {
    const centerCol = PUZZLE_CONFIG.CENTER_COL;
    const minCol = centerCol - 2;
    const maxCol = centerCol + 2;
    
    const possibleStarts: number[] = [];
    
    for (let start = minCol; start <= maxCol; start++) {
      const end = start + length - 1;
      
      if (start >= minCol && end <= maxCol) {
        if (start <= centerCol && end >= centerCol) {
          possibleStarts.push(start);
        }
      }
    }
    
    const startCol = possibleStarts[Math.floor(Math.random() * possibleStarts.length)];
    const endCol = startCol + length - 1;
    
    return { startCol, endCol };
  }
}

export const puzzleGenerator = new PuzzleGenerator();

