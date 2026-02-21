import { Grid, Cell, PuzzleConfig, WordSlot, HardMatchTile, SoftMatchTile } from './types';
import { PUZZLE_CONFIG } from './config';

export class PuzzleGenerator {
  generatePuzzleConfig(paddingRowsTop: number = 1, paddingRowsBottom: number = 1): PuzzleConfig {
    const wordSlots: WordSlot[] = [];
    
    for (let i = 0; i < PUZZLE_CONFIG.WORD_ROWS; i++) {
      const length = this.randomWordLength();
      const { startCol, endCol } = this.calculateWordPosition(length);
      
      wordSlots.push({
        row: i + paddingRowsTop,
        length,
        startCol,
        endCol,
      });
    }
    
    const totalRows = PUZZLE_CONFIG.WORD_ROWS + paddingRowsTop + paddingRowsBottom;
    
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
    
    this.placeHardMatchTiles(grid, config);
    this.placeSoftMatchTiles(grid, config);
    this.ensureMinimumRuleTiles(grid, config);
    
    return grid;
  }
  
  private placeHardMatchTiles(grid: Grid, config: PuzzleConfig): void {
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
        
        const topTile: HardMatchTile = {
          type: 'hardMatch',
          constraint: {
            pairedRow: randomRow + 1,
            pairedCol: randomCol,
            position: 'top',
          },
        };
        
        const bottomTile: HardMatchTile = {
          type: 'hardMatch',
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
  
  private placeSoftMatchTiles(grid: Grid, config: PuzzleConfig): void {
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
        const tile: SoftMatchTile = {
          type: 'softMatch',
          constraint: {
            nextRow: randomRow + 1,
          },
        };
        
        grid.cells[randomRow][randomCol].ruleTile = tile;
        placedTiles++;
      }
    }
  }
  
  private countRuleTilesInRow(grid: Grid, row: number): number {
    let count = 0;
    for (let col = 0; col < grid.cols; col++) {
      const cell = grid.cells[row][col];
      if (cell.accessible && cell.ruleTile) {
        // Only count master/source tiles
        if (cell.ruleTile.type === 'hardMatch') {
          const tile = cell.ruleTile as HardMatchTile;
          if (tile.constraint.position === 'top') count++;
        } else if (cell.ruleTile.type === 'softMatch') {
          count++;
        }
      }
    }
    return count;
  }

  private ensureMinimumRuleTiles(grid: Grid, config: PuzzleConfig): void {
    const min = PUZZLE_CONFIG.MIN_RULE_TILES_PER_WORD;
    if (min <= 0) return;

    for (const slot of config.wordSlots) {
      let deficit = min - this.countRuleTilesInRow(grid, slot.row);

      for (let col = slot.startCol; col <= slot.endCol && deficit > 0; col++) {
        const cell = grid.cells[slot.row][col];
        if (!cell.accessible || cell.ruleTile) continue;

        // Try ● pair with the row below
        if (slot.row + 1 < grid.rows) {
          const below = grid.cells[slot.row + 1][col];
          if (below.accessible && !below.ruleTile) {
            cell.ruleTile = {
              type: 'hardMatch',
              constraint: { pairedRow: slot.row + 1, pairedCol: col, position: 'top' },
            } as HardMatchTile;
            below.ruleTile = {
              type: 'hardMatch',
              constraint: { pairedRow: slot.row, pairedCol: col, position: 'bottom' },
            } as HardMatchTile;
            deficit--;
            continue;
          }
        }

        // Try ○ with the next row
        if (slot.row + 1 < grid.rows &&
            grid.cells[slot.row + 1].some(c => c.accessible)) {
          cell.ruleTile = {
            type: 'softMatch',
            constraint: { nextRow: slot.row + 1 },
          } as SoftMatchTile;
          deficit--;
        }
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

