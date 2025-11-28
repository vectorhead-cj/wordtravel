import { Grid, Cell, PuzzleConfig, WordSlot, SameLetterPositionTile, SameLetterTile } from './types';
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
    
    const grid = {
      rows: config.rows,
      cols: config.cols,
      cells,
    };
    
    this.placeSameLetterPositionTiles(grid, config);
    this.placeSameLetterTiles(grid, config);
    
    return grid;
  }
  
  private placeSameLetterPositionTiles(grid: Grid, config: PuzzleConfig): void {
    const targetPairs = Math.round(PUZZLE_CONFIG.WORD_ROWS * 0.5);
    let placedPairs = 0;
    const maxAttempts = 100;
    let attempts = 0;
    
    while (placedPairs < targetPairs && attempts < maxAttempts) {
      attempts++;
      
      const randomRow = Math.floor(Math.random() * (config.rows - 1));
      const randomCol = Math.floor(Math.random() * config.cols);
      
      const topCell = grid.cells[randomRow][randomCol];
      const bottomCell = grid.cells[randomRow + 1][randomCol];
      
      if (topCell.accessible && bottomCell.accessible && 
          !topCell.ruleTile && !bottomCell.ruleTile) {
        
        const topTile: SameLetterPositionTile = {
          type: 'sameLetterPosition',
          constraint: {
            pairedRow: randomRow + 1,
            pairedCol: randomCol,
            position: 'top',
          },
        };
        
        const bottomTile: SameLetterPositionTile = {
          type: 'sameLetterPosition',
          constraint: {
            pairedRow: randomRow,
            pairedCol: randomCol,
            position: 'bottom',
          },
        };
        
        grid.cells[randomRow][randomCol].ruleTile = topTile;
        grid.cells[randomRow + 1][randomCol].ruleTile = bottomTile;
        
        placedPairs++;
      }
    }
  }
  
  private placeSameLetterTiles(grid: Grid, config: PuzzleConfig): void {
    const targetTiles = Math.round(PUZZLE_CONFIG.WORD_ROWS * 0.5);
    let placedTiles = 0;
    const maxAttempts = 100;
    let attempts = 0;
    
    while (placedTiles < targetTiles && attempts < maxAttempts) {
      attempts++;
      
      const randomRow = Math.floor(Math.random() * (config.rows - 2));
      const randomCol = Math.floor(Math.random() * config.cols);
      
      const currentCell = grid.cells[randomRow][randomCol];
      const hasAccessibleNextRow = grid.cells[randomRow + 1].some(cell => cell.accessible);
      
      if (currentCell.accessible && !currentCell.ruleTile && hasAccessibleNextRow) {
        const tile: SameLetterTile = {
          type: 'sameLetter',
          constraint: {
            nextRow: randomRow + 1,
          },
        };
        
        grid.cells[randomRow][randomCol].ruleTile = tile;
        placedTiles++;
      }
    }
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

