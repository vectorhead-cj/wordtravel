import { Grid, Cell, PuzzleConfig, WordSlot, PuzzleType, HardMatchTile, SoftMatchTile, ForbiddenMatchTile } from './types';
import { PUZZLE_CONFIG } from './config';
import { generatorDictionary, ConstraintQuery } from './Dictionary';
import { serializeGrid } from './PuzzleNotation';

const MAX_GENERATION_ATTEMPTS = 50;

export class PuzzleGenerator {
  generatePuzzle(puzzleType: PuzzleType = 'open'): string {
    let lastGrid: Grid | null = null;
    for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
      const config = this.generatePuzzleConfig(0, 0, puzzleType);
      const grid = this.createGridFromConfig(config, puzzleType);
      lastGrid = grid;
      if (this.isGridValid(grid)) {
        return serializeGrid(grid);
      }
    }
    console.warn('[PuzzleGenerator] Max generation attempts reached, returning best-effort puzzle');
    return serializeGrid(lastGrid!);
  }

  generatePuzzleConfig(paddingRowsTop: number = 1, paddingRowsBottom: number = 1, puzzleType: PuzzleType = 'open'): PuzzleConfig {
    const wordSlots: WordSlot[] = [];
    
    for (let i = 0; i < PUZZLE_CONFIG.WORD_ROWS; i++) {
      const isFirstRow = i === 0;
      const isLastRow = i === PUZZLE_CONFIG.WORD_ROWS - 1;

      const fixFirst = puzzleType === 'bridge';
      const fixLast = puzzleType === 'bridge' || puzzleType === 'semi';

      const length = (isFirstRow && fixFirst) || (isLastRow && fixLast)
        ? this.randomFixedWordLength()
        : this.randomWordLength();

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
  
  createGridFromConfig(config: PuzzleConfig, puzzleType: PuzzleType = 'open'): Grid {
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
    
    this.prefillFixedWords(grid, config, puzzleType);
    this.placeFixedLetterTiles(grid, config);
    this.placeHardMatchTiles(grid, config);
    this.placeSoftMatchTiles(grid, config);
    this.placeForbiddenMatchTiles(grid, config);
    this.ensureMinimumRuleTiles(grid, config);
    
    return grid;
  }
  
  private placeFixedLetterTiles(grid: Grid, _config: PuzzleConfig): void {
    const target = PUZZLE_CONFIG.FIXED_TILES_PER_PUZZLE;
    const candidates: { row: number; col: number }[] = [];

    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.cols; col++) {
        const cell = grid.cells[row][col];
        if (cell.accessible && !cell.fixed) {
          candidates.push({ row, col });
        }
      }
    }

    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    const alphabet = PUZZLE_CONFIG.FIXED_LETTER_ALPHABET;
    const usedRows = new Set<number>();
    let placed = 0;

    for (const { row, col } of candidates) {
      if (placed >= target) break;
      if (usedRows.has(row)) continue;

      const letter = alphabet[Math.floor(Math.random() * alphabet.length)];
      grid.cells[row][col].letter = letter;
      grid.cells[row][col].state = 'filled';
      grid.cells[row][col].fixed = true;

      usedRows.add(row);
      placed++;
    }
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
          !topCell.ruleTile && !bottomCell.ruleTile &&
          !(topCell.fixed && bottomCell.fixed && topCell.letter !== bottomCell.letter)) {
        
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
  
  private placeForbiddenMatchTiles(grid: Grid, config: PuzzleConfig): void {
    const targetTiles = Math.round(PUZZLE_CONFIG.WORD_ROWS * 0.3);
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
        const tile: ForbiddenMatchTile = {
          type: 'forbiddenMatch',
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
          if (cell.ruleTile.constraint.position === 'top') count++;
        } else if (cell.ruleTile.type === 'softMatch') {
          count++;
        } else if (cell.ruleTile.type === 'forbiddenMatch') {
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
          if (below.accessible && !below.ruleTile &&
              !(cell.fixed && below.fixed && cell.letter !== below.letter)) {
            cell.ruleTile = {
              type: 'hardMatch',
              constraint: { pairedRow: slot.row + 1, pairedCol: col, position: 'top' },
            };
            below.ruleTile = {
              type: 'hardMatch',
              constraint: { pairedRow: slot.row, pairedCol: col, position: 'bottom' },
            };
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
          };
          deficit--;
        }
      }
    }
  }

  private isGridValid(grid: Grid): boolean {
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        const cell = grid.cells[r][c];
        if (!cell.accessible || !cell.ruleTile) continue;

        if (cell.ruleTile.type === 'hardMatch' && cell.ruleTile.constraint.position === 'top') {
          const { pairedRow, pairedCol } = cell.ruleTile.constraint;
          const paired = grid.cells[pairedRow]?.[pairedCol];
          if (cell.fixed && paired?.fixed && cell.letter !== paired.letter) {
            return false;
          }
        }

        if (cell.ruleTile.type === 'softMatch' && cell.fixed && cell.letter) {
          const targetRow = cell.ruleTile.constraint.nextRow;
          const targetCells = grid.cells[targetRow];
          if (!targetCells) continue;
          const allFixed = targetCells.every(tc => !tc.accessible || tc.fixed);
          if (allFixed) {
            const hasMatch = targetCells.some(tc => tc.accessible && tc.letter === cell.letter);
            if (!hasMatch) return false;
          }
        }

        if (cell.ruleTile.type === 'forbiddenMatch' && cell.fixed && cell.letter) {
          const targetRow = cell.ruleTile.constraint.nextRow;
          const targetCells = grid.cells[targetRow];
          if (!targetCells) continue;
          const hasConflict = targetCells.some(tc => tc.accessible && tc.fixed && tc.letter === cell.letter);
          if (hasConflict) return false;
        }
      }

      // Cross-rule check: hard/soft match requiring a letter vs forbidden banning it
      const requiredInRow = new Map<number, Set<string>>();
      const bannedFromRow = new Map<number, Set<string>>();

      for (let c = 0; c < grid.cols; c++) {
        const cell = grid.cells[r][c];
        if (!cell.accessible || !cell.letter || !cell.ruleTile) continue;

        if (cell.ruleTile.type === 'hardMatch' && cell.ruleTile.constraint.position === 'top') {
          const target = cell.ruleTile.constraint.pairedRow;
          if (!requiredInRow.has(target)) requiredInRow.set(target, new Set());
          requiredInRow.get(target)!.add(cell.letter);
        } else if (cell.ruleTile.type === 'softMatch') {
          const target = cell.ruleTile.constraint.nextRow;
          if (!requiredInRow.has(target)) requiredInRow.set(target, new Set());
          requiredInRow.get(target)!.add(cell.letter);
        } else if (cell.ruleTile.type === 'forbiddenMatch') {
          const target = cell.ruleTile.constraint.nextRow;
          if (!bannedFromRow.has(target)) bannedFromRow.set(target, new Set());
          bannedFromRow.get(target)!.add(cell.letter);
        }
      }

      for (const [targetRow, required] of requiredInRow) {
        const banned = bannedFromRow.get(targetRow);
        if (!banned) continue;
        for (const letter of required) {
          if (banned.has(letter)) return false;
        }
      }
    }

    // Dictionary feasibility: for each non-fixed row, check that at least one
    // word exists that satisfies all constraints from completed (fixed) rows.
    for (let r = 0; r < grid.rows; r++) {
      const accessibleCols: number[] = [];
      for (let c = 0; c < grid.cols; c++) {
        if (grid.cells[r][c].accessible) accessibleCols.push(c);
      }
      if (accessibleCols.length === 0) continue;

      const allFixed = accessibleCols.every(c => grid.cells[r][c].fixed);
      if (allFixed) continue;

      const positionConstraints = new Map<number, string>();
      const mustContain: string[] = [];
      const mustNotContain = new Set<string>();

      for (let i = 0; i < accessibleCols.length; i++) {
        const col = accessibleCols[i];
        const cell = grid.cells[r][col];

        if (cell.fixed && cell.letter) {
          positionConstraints.set(i, cell.letter.toLowerCase());
          continue;
        }

        if (cell.ruleTile?.type === 'hardMatch') {
          const { pairedRow, pairedCol } = cell.ruleTile.constraint;
          const paired = grid.cells[pairedRow]?.[pairedCol];
          if (paired?.fixed && paired.letter) {
            positionConstraints.set(i, paired.letter.toLowerCase());
          }
        }
      }

      for (let sourceRow = 0; sourceRow < grid.rows; sourceRow++) {
        const sourceAllFixed = grid.cells[sourceRow]
          .filter(c => c.accessible)
          .every(c => c.fixed);
        if (!sourceAllFixed) continue;

        for (let c = 0; c < grid.cols; c++) {
          const cell = grid.cells[sourceRow][c];
          if (!cell.accessible || !cell.letter || !cell.ruleTile) continue;

          if (cell.ruleTile.type === 'softMatch' && cell.ruleTile.constraint.nextRow === r) {
            mustContain.push(cell.letter.toLowerCase());
          } else if (cell.ruleTile.type === 'forbiddenMatch' && cell.ruleTile.constraint.nextRow === r) {
            mustNotContain.add(cell.letter.toLowerCase());
          }
        }
      }

      if (positionConstraints.size === 0 && mustContain.length === 0 && mustNotContain.size === 0) {
        continue;
      }

      const wordLength = accessibleCols.length;
      const query: ConstraintQuery = {
        positionConstraints: positionConstraints.size > 0 ? positionConstraints : undefined,
        mustContain: mustContain.length > 0 ? mustContain : undefined,
        mustNotContain: mustNotContain.size > 0 ? mustNotContain : undefined,
      };
      const candidates = generatorDictionary.getWordsMatchingConstraints(wordLength, query);
      if (candidates.length === 0) return false;
    }

    return true;
  }

  private prefillFixedWords(grid: Grid, config: PuzzleConfig, puzzleType: PuzzleType): void {
    if (puzzleType === 'open') return;

    const firstSlot = config.wordSlots[0];
    const lastSlot = config.wordSlots[config.wordSlots.length - 1];

    if (puzzleType === 'bridge') {
      this.fillSlotWithRandomWord(grid, firstSlot);
    }

    if (puzzleType === 'bridge' || puzzleType === 'semi') {
      this.fillSlotWithRandomWord(grid, lastSlot);
    }
  }

  private fillSlotWithRandomWord(grid: Grid, slot: WordSlot): void {
    const word = generatorDictionary.getRandomWord(slot.length);
    if (!word) return;

    for (let i = 0; i < slot.length; i++) {
      const col = slot.startCol + i;
      const cell = grid.cells[slot.row][col];
      cell.letter = word[i].toUpperCase();
      cell.state = 'locked';
      cell.fixed = true;
      cell.validation = 'correct';
    }
  }

  private randomFixedWordLength(): number {
    return Math.random() < 0.5 ? 3 : 4;
  }

  private randomWordLength(): number {
    const weights = PUZZLE_CONFIG.WORD_LENGTH_WEIGHTS;
    const entries = Object.entries(weights).map(([len, w]) => [Number(len), w] as const);
    const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0);
    let roll = Math.random() * totalWeight;

    for (const [length, weight] of entries) {
      roll -= weight;
      if (roll <= 0) return length;
    }

    return entries[entries.length - 1][0];
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

