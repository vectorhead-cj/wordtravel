import {
  Grid,
  Cell,
  PuzzleConfig,
  WordSlot,
  PuzzleType,
  Difficulty,
  HardMatchTile,
  SoftMatchTile,
  ForbiddenMatchTile,
  RuleTile,
  SoftForbiddenConstraint,
  addCellRuleTile,
  getCellRuleTiles,
  setCellRuleTiles,
  softForbiddenTargetRows,
  lastWordSlotRow,
} from './types';
import { PUZZLE_CONFIG, GENERATION_PROFILES, GenerationProfile } from './config';
import { generatorDictionary, ConstraintQuery } from './Dictionary';
import { serializeGrid } from './PuzzleNotation';
import { simulatePuzzleDifficulty } from './DifficultySimulator';

export interface GeneratedPuzzle {
  puzzle: string;
  difficulty: Difficulty;
  successRate: number;
}

export class PuzzleGenerator {
  generatePuzzle(puzzleType: PuzzleType = 'open', targetDifficulty?: Difficulty): GeneratedPuzzle {
    const maxAttempts = 500;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const difficulty = targetDifficulty ?? 'medium';
      const profile = GENERATION_PROFILES[difficulty];

      const grid = this.generateStaged(puzzleType, difficulty, profile);
      if (!grid) continue;

      const sim = simulatePuzzleDifficulty(grid);
      if (sim.difficulty === null) continue;
      if (targetDifficulty !== undefined && sim.difficulty !== targetDifficulty) continue;

      return {
        puzzle: serializeGrid(grid),
        difficulty: sim.difficulty,
        successRate: sim.successRate,
      };
    }
    throw new Error(`Failed to generate puzzle after ${maxAttempts} attempts`);
  }

  /** Generate a validated grid without running difficulty simulation. */
  generateGrid(puzzleType: PuzzleType = 'open', difficulty: Difficulty = 'medium', maxAttempts = 200): Grid {
    const profile = GENERATION_PROFILES[difficulty];
    for (let i = 0; i < maxAttempts; i++) {
      const grid = this.generateStaged(puzzleType, difficulty, profile);
      if (grid) return grid;
    }
    throw new Error(`Failed to generate valid grid in ${maxAttempts} attempts`);
  }

  private generateStaged(
    puzzleType: PuzzleType,
    difficulty: Difficulty,
    profile: GenerationProfile,
  ): Grid | null {
    // Stage 1: generate config with word length sequence validation
    const config = this.generateConfig(puzzleType, profile);
    if (!config) return null;

    // Stage 2: build empty grid + prefill fixed words
    const grid = this.buildEmptyGrid(config);
    this.prefillFixedWords(grid, config, puzzleType);

    // Stage 3: place fixed letters
    this.placeFixedLetters(grid, profile);

    // Stage 4: place hard-match chains with local retry
    let hardOk = false;
    for (let i = 0; i < 5 && !hardOk; i++) {
      this.clearTilesByType(grid, 'hardMatch');
      this.placeHardMatchChains(grid, config, profile, difficulty);
      hardOk = this.validateAfterHardMatch(grid, config, profile);
    }
    if (!hardOk) return null;

    // Stage 5: place soft/forbidden tiles with local retry
    let softOk = false;
    for (let i = 0; i < 5 && !softOk; i++) {
      this.clearTilesByType(grid, 'softMatch');
      this.clearTilesByType(grid, 'forbiddenMatch');
      this.placeSoftForbiddenTiles(grid, config, profile, difficulty, 'softMatch', profile.softMatchTiles);
      this.placeSoftForbiddenTiles(grid, config, profile, difficulty, 'forbiddenMatch', profile.forbiddenTiles);
      softOk = this.validateRuleConflicts(grid) &&
               this.validateDictionaryFeasibility(grid, config, profile.minCandidatesPerRow);
    }
    if (!softOk) return null;

    // Stage 6: ensure minimums
    this.ensureMinimumRuleTiles(grid, config, profile, difficulty);

    // Stage 7: full validation
    if (!this.fullValidation(grid, config, profile)) return null;

    return grid;
  }

  // ---------------------------------------------------------------------------
  // Stage 1: Config generation
  // ---------------------------------------------------------------------------

  private generateConfig(puzzleType: PuzzleType, profile: GenerationProfile): PuzzleConfig | null {
    for (let attempt = 0; attempt < 20; attempt++) {
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
        wordSlots.push({ row: i, length, startCol, endCol });
      }

      if (this.isValidLengthSequence(wordSlots, profile.maxConsecutiveSameLength)) {
        return { wordSlots, rows: PUZZLE_CONFIG.WORD_ROWS, cols: PUZZLE_CONFIG.GRID_COLS };
      }
    }
    return null;
  }

  private isValidLengthSequence(slots: WordSlot[], maxConsecutive: number): boolean {
    let streak = 1;
    for (let i = 1; i < slots.length; i++) {
      if (slots[i].length === slots[i - 1].length) {
        streak++;
        if (streak > maxConsecutive) return false;
      } else {
        streak = 1;
      }
    }
    return true;
  }

  // ---------------------------------------------------------------------------
  // Stage 2: Grid construction + prefill
  // ---------------------------------------------------------------------------

  private buildEmptyGrid(config: PuzzleConfig): Grid {
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
    return { rows: config.rows, cols: config.cols, cells };
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

  // ---------------------------------------------------------------------------
  // Stage 3: Fixed letters
  // ---------------------------------------------------------------------------

  private placeFixedLetters(grid: Grid, profile: GenerationProfile): void {
    const target = profile.fixedTiles;
    const candidates: { row: number; col: number }[] = [];

    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.cols; col++) {
        const cell = grid.cells[row][col];
        if (cell.accessible && !cell.fixed) {
          candidates.push({ row, col });
        }
      }
    }

    this.shuffle(candidates);

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

  // ---------------------------------------------------------------------------
  // Stage 4: Hard-match chains
  // ---------------------------------------------------------------------------

  private placeHardMatchChains(
    grid: Grid,
    config: PuzzleConfig,
    profile: GenerationProfile,
    difficulty: Difficulty,
  ): void {
    let remainingConnections = profile.hardMatchPairs;
    const maxAttempts = 100;
    let attempts = 0;

    while (remainingConnections > 0 && attempts < maxAttempts) {
      attempts++;

      const desiredLength = Math.min(profile.hardMatchMaxChainLength, remainingConnections + 1);

      // Try desired length, then fall back to shorter chains
      let placed = false;
      for (let chainLen = desiredLength; chainLen >= 2 && !placed; chainLen--) {
        placed = this.tryPlaceChain(grid, config, difficulty, chainLen);
        if (placed) {
          remainingConnections -= (chainLen - 1);
        }
      }
    }
  }

  private tryPlaceChain(
    grid: Grid,
    config: PuzzleConfig,
    difficulty: Difficulty,
    chainLength: number,
  ): boolean {
    const maxStartRow = config.rows - chainLength;
    if (maxStartRow < 0) return false;

    const startRow = Math.floor(Math.random() * (maxStartRow + 1));
    const col = Math.floor(Math.random() * config.cols);

    // Verify all cells in the chain are valid (including visual half availability)
    for (let offset = 0; offset < chainLength; offset++) {
      const row = startRow + offset;
      const cell = grid.cells[row][col];
      if (!cell.accessible || cell.fixed) return false;

      const isFirst = offset === 0;
      const isLast = offset === chainLength - 1;
      // First cell needs bottom half (top tile pointing down)
      // Last cell needs top half (bottom tile pointing up)
      // Middle cells need both halves
      const needsTop = !isFirst;
      const needsBottom = !isLast;

      if (isFirst || isLast) {
        if (!this.canAddRuleWithHalves(cell, difficulty, needsTop, needsBottom)) return false;
      } else {
        // Middle cell needs 2 rule slots + both halves free
        if (getCellRuleTiles(cell).length + 2 > this.maxRulesPerCell(difficulty)) return false;
        const halves = this.occupiedHalves(cell);
        if (halves.top || halves.bottom) return false;
      }
    }

    // Place the chain
    for (let offset = 0; offset < chainLength; offset++) {
      const row = startRow + offset;

      if (offset < chainLength - 1) {
        // Top tile pointing down
        addCellRuleTile(grid.cells[row][col], {
          type: 'hardMatch',
          constraint: { pairedRow: row + 1, pairedCol: col, position: 'top' },
        });
      }

      if (offset > 0) {
        // Bottom tile pointing up
        addCellRuleTile(grid.cells[row][col], {
          type: 'hardMatch',
          constraint: { pairedRow: row - 1, pairedCol: col, position: 'bottom' },
        });
      }
    }

    return true;
  }

  // ---------------------------------------------------------------------------
  // Stage 5: Soft/forbidden tiles (merged)
  // ---------------------------------------------------------------------------

  private placeSoftForbiddenTiles(
    grid: Grid,
    config: PuzzleConfig,
    _profile: GenerationProfile,
    difficulty: Difficulty,
    tileType: 'softMatch' | 'forbiddenMatch',
    targetCount: number,
  ): void {
    let placed = 0;
    const maxAttempts = 100;
    let attempts = 0;

    while (placed < targetCount && attempts < maxAttempts) {
      attempts++;

      const randomRow = Math.floor(Math.random() * config.rows);
      const randomCol = Math.floor(Math.random() * config.cols);

      const cell = grid.cells[randomRow][randomCol];
      if (!cell.accessible) continue;

      const { canPointDown, hasPrevRow } = this.getRowDirectionality(grid, config, randomRow);

      let constraint: SoftForbiddenConstraint;
      let needsTop: boolean;
      let needsBottom: boolean;

      if (difficulty !== 'hard') {
        if (!canPointDown) continue;
        constraint = { nextRow: randomRow + 1 };
        needsTop = false;
        needsBottom = true;
      } else {
        if (!(canPointDown && hasPrevRow)) continue;
        constraint = { nextRow: randomRow + 1, prevRow: randomRow - 1 };
        needsTop = true;
        needsBottom = true;
      }

      if (!this.canAddRuleWithHalves(cell, difficulty, needsTop, needsBottom)) continue;

      // Trivial-constraint check only for soft match
      if (tileType === 'softMatch' && cell.fixed && cell.letter) {
        if (this.isTrivialSoftConstraint(grid, cell.letter, constraint)) continue;
      }

      addCellRuleTile(grid.cells[randomRow][randomCol], {
        type: tileType,
        constraint: { ...constraint },
      } as RuleTile);
      placed++;
    }
  }

  private isTrivialSoftConstraint(
    grid: Grid,
    letter: string,
    constraint: SoftForbiddenConstraint,
  ): boolean {
    for (const targetRow of softForbiddenTargetRows(constraint)) {
      if (grid.cells[targetRow]?.some(
        tc => tc.accessible && tc.fixed && tc.letter === letter,
      )) {
        return true;
      }
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // Stage 6: Ensure minimums
  // ---------------------------------------------------------------------------

  private ensureMinimumRuleTiles(
    grid: Grid,
    config: PuzzleConfig,
    profile: GenerationProfile,
    difficulty: Difficulty,
  ): void {
    const min = profile.minRuleTilesPerWord;
    if (min <= 0) return;

    const lastWordRow = lastWordSlotRow(config);

    for (const slot of config.wordSlots) {
      let deficit = min - this.countRuleTilesInRow(grid, slot.row);

      for (let col = slot.startCol; col <= slot.endCol && deficit > 0; col++) {
        const cell = grid.cells[slot.row][col];
        if (!cell.accessible) continue;

        // Try hard-match pair with the row below
        // Top cell needs bottom half free; bottom cell needs top half free
        if (slot.row + 1 < grid.rows) {
          const below = grid.cells[slot.row + 1][col];
          if (below.accessible && !cell.fixed && !below.fixed &&
              this.canAddRuleWithHalves(cell, difficulty, false, true) &&
              this.canAddRuleWithHalves(below, difficulty, true, false)) {
            addCellRuleTile(cell, {
              type: 'hardMatch',
              constraint: { pairedRow: slot.row + 1, pairedCol: col, position: 'top' },
            });
            addCellRuleTile(below, {
              type: 'hardMatch',
              constraint: { pairedRow: slot.row, pairedCol: col, position: 'bottom' },
            });
            deficit--;
            continue;
          }
        }

        // Try soft-match with the next row (never on the bottom word row)
        const { canPointDown, hasPrevRow } = this.getRowDirectionality(grid, config, slot.row);
        if (canPointDown) {
          const bidirectional = difficulty === 'hard' && hasPrevRow;
          const needsTop = bidirectional;
          const needsBottom = true;
          if (!this.canAddRuleWithHalves(cell, difficulty, needsTop, needsBottom)) continue;

          const trivial = cell.fixed && cell.letter &&
            grid.cells[slot.row + 1].some(
              tc => tc.accessible && tc.fixed && tc.letter === cell.letter,
            );
          if (trivial) continue;

          addCellRuleTile(cell, {
            type: 'softMatch',
            constraint: bidirectional
              ? { nextRow: slot.row + 1, prevRow: slot.row - 1 }
              : { nextRow: slot.row + 1 },
          });
          deficit--;
        }
      }
    }
  }

  private countRuleTilesInRow(grid: Grid, row: number): number {
    let count = 0;
    for (let col = 0; col < grid.cols; col++) {
      const cell = grid.cells[row][col];
      if (!cell.accessible) continue;
      const rules = getCellRuleTiles(cell);
      if (rules.some(r => r.type === 'hardMatch' && r.constraint.position === 'top')) {
        count++;
        continue;
      }
      if (rules.some(r => r.type === 'softMatch' || r.type === 'forbiddenMatch')) {
        count++;
      }
    }
    return count;
  }

  // ---------------------------------------------------------------------------
  // Stage 7: Validation
  // ---------------------------------------------------------------------------

  private fullValidation(grid: Grid, config: PuzzleConfig, profile: GenerationProfile): boolean {
    return this.validateRuleConflicts(grid) &&
           this.validateDictionaryFeasibility(grid, config, profile.minCandidatesPerRow) &&
           this.validateForbiddenGrouping(grid, config, profile.minForbiddenGroupSize);
  }

  private validateAfterHardMatch(grid: Grid, config: PuzzleConfig, profile: GenerationProfile): boolean {
    // Quick check: no hard-match on fixed cells, and dictionary feasibility
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        const cell = grid.cells[r][c];
        if (!cell.accessible) continue;
        for (const rule of getCellRuleTiles(cell)) {
          if (rule.type === 'hardMatch' && cell.fixed) return false;
        }
      }
    }
    return this.validateDictionaryFeasibility(grid, config, profile.minCandidatesPerRow);
  }

  private validateRuleConflicts(grid: Grid): boolean {
    for (let r = 0; r < grid.rows; r++) {
      // Per-cell checks
      for (let c = 0; c < grid.cols; c++) {
        const cell = grid.cells[r][c];
        if (!cell.accessible) continue;

        // Visual half collision check
        if (!this.validateCellHalves(cell)) return false;

        for (const rule of getCellRuleTiles(cell)) {
          if (rule.type === 'hardMatch' && cell.fixed) return false;

          if (rule.type === 'softMatch' && cell.fixed && cell.letter) {
            for (const targetRow of softForbiddenTargetRows(rule.constraint)) {
              const targetCells = grid.cells[targetRow];
              if (!targetCells) continue;
              if (targetCells.some(tc => tc.accessible && tc.fixed && tc.letter === cell.letter)) return false;
              if (targetCells.every(tc => !tc.accessible || tc.fixed)) return false;
            }
          }

          if (rule.type === 'forbiddenMatch' && cell.fixed && cell.letter) {
            for (const targetRow of softForbiddenTargetRows(rule.constraint)) {
              const targetCells = grid.cells[targetRow];
              if (!targetCells) continue;
              if (targetCells.some(tc => tc.accessible && tc.fixed && tc.letter === cell.letter)) return false;
            }
          }
        }
      }

      // Cross-rule check: required vs banned letters in same target row
      const requiredInRow = new Map<number, Set<string>>();
      const bannedFromRow = new Map<number, Set<string>>();

      for (let c = 0; c < grid.cols; c++) {
        const cell = grid.cells[r][c];
        if (!cell.accessible || !cell.letter) continue;

        for (const rule of getCellRuleTiles(cell)) {
          if (rule.type === 'hardMatch' && rule.constraint.position === 'top') {
            const target = rule.constraint.pairedRow;
            if (!requiredInRow.has(target)) requiredInRow.set(target, new Set());
            requiredInRow.get(target)!.add(cell.letter);
          } else if (rule.type === 'softMatch') {
            for (const target of softForbiddenTargetRows(rule.constraint)) {
              if (!requiredInRow.has(target)) requiredInRow.set(target, new Set());
              requiredInRow.get(target)!.add(cell.letter);
            }
          } else if (rule.type === 'forbiddenMatch') {
            for (const target of softForbiddenTargetRows(rule.constraint)) {
              if (!bannedFromRow.has(target)) bannedFromRow.set(target, new Set());
              bannedFromRow.get(target)!.add(cell.letter);
            }
          }
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

    return true;
  }

  private validateDictionaryFeasibility(
    grid: Grid,
    config: PuzzleConfig,
    minCandidatesPerRow: number,
  ): boolean {
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

        for (const rule of getCellRuleTiles(cell)) {
          if (rule.type !== 'hardMatch') continue;
          const { pairedRow, pairedCol } = rule.constraint;
          const paired = grid.cells[pairedRow]?.[pairedCol];
          if (paired?.fixed && paired.letter) {
            positionConstraints.set(i, paired.letter.toLowerCase());
          }
        }
      }

      // Gather soft/forbidden constraints from fully-fixed source rows
      for (let sourceRow = 0; sourceRow < grid.rows; sourceRow++) {
        const sourceAllFixed = grid.cells[sourceRow]
          .filter(c => c.accessible)
          .every(c => c.fixed);
        if (!sourceAllFixed) continue;

        for (let c = 0; c < grid.cols; c++) {
          const cell = grid.cells[sourceRow][c];
          if (!cell.accessible || !cell.letter) continue;

          for (const rule of getCellRuleTiles(cell)) {
            if (rule.type === 'softMatch' && softForbiddenTargetRows(rule.constraint).includes(r)) {
              mustContain.push(cell.letter.toLowerCase());
            } else if (rule.type === 'forbiddenMatch' && softForbiddenTargetRows(rule.constraint).includes(r)) {
              mustNotContain.add(cell.letter.toLowerCase());
            }
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
      if (candidates.length < minCandidatesPerRow) return false;
    }

    return true;
  }

  private validateForbiddenGrouping(
    grid: Grid,
    config: PuzzleConfig,
    minForbiddenGroupSize: number,
  ): boolean {
    if (minForbiddenGroupSize <= 1) return true;

    for (const slot of config.wordSlots) {
      let forbiddenCount = 0;
      let hasOtherRule = false;

      for (let col = slot.startCol; col <= slot.endCol; col++) {
        const cell = grid.cells[slot.row][col];
        for (const rule of getCellRuleTiles(cell)) {
          if (rule.type === 'forbiddenMatch') {
            forbiddenCount++;
          } else {
            hasOtherRule = true;
          }
        }
      }

      if (forbiddenCount > 0 && !hasOtherRule && forbiddenCount < minForbiddenGroupSize) {
        return false;
      }
    }
    return true;
  }

  // ---------------------------------------------------------------------------
  // Shared helpers
  // ---------------------------------------------------------------------------

  private getRowDirectionality(
    grid: Grid,
    config: PuzzleConfig,
    row: number,
  ): { canPointDown: boolean; hasPrevRow: boolean } {
    const lastWordRow = lastWordSlotRow(config);
    const canPointDown =
      row < lastWordRow &&
      row + 1 < config.rows &&
      grid.cells[row + 1].some(cell => cell.accessible);
    const hasPrevRow =
      row > 0 && grid.cells[row - 1].some(cell => cell.accessible);
    return { canPointDown, hasPrevRow };
  }

  private maxRulesPerCell(difficulty: Difficulty): number {
    return difficulty === 'hard' ? 2 : 1;
  }

  /**
   * Which visual halves of a cell are occupied by existing rule tiles.
   * - Hard-match top (pointing down) occupies the bottom half.
   * - Hard-match bottom (pointing up) occupies the top half.
   * - Soft/forbidden with nextRow occupies the bottom half.
   * - Soft/forbidden with prevRow occupies the top half.
   */
  private occupiedHalves(cell: Cell): { top: boolean; bottom: boolean } {
    let top = false;
    let bottom = false;
    for (const rule of getCellRuleTiles(cell)) {
      if (rule.type === 'hardMatch') {
        if (rule.constraint.position === 'top') bottom = true;   // points down → bottom half
        if (rule.constraint.position === 'bottom') top = true;   // points up → top half
      } else {
        if (rule.constraint.nextRow !== undefined) bottom = true;
        if (rule.constraint.prevRow !== undefined) top = true;
      }
    }
    return { top, bottom };
  }

  private canAddRule(cell: Cell, difficulty: Difficulty): boolean {
    return getCellRuleTiles(cell).length < this.maxRulesPerCell(difficulty);
  }

  /** Verify no cell half is used by more than one rule tile. */
  private validateCellHalves(cell: Cell): boolean {
    let topCount = 0;
    let bottomCount = 0;
    for (const rule of getCellRuleTiles(cell)) {
      if (rule.type === 'hardMatch') {
        if (rule.constraint.position === 'top') bottomCount++;
        if (rule.constraint.position === 'bottom') topCount++;
      } else {
        if (rule.constraint.nextRow !== undefined) bottomCount++;
        if (rule.constraint.prevRow !== undefined) topCount++;
      }
    }
    return topCount <= 1 && bottomCount <= 1;
  }

  /** Check whether a rule tile can be added without a visual half collision. */
  private canAddRuleWithHalves(cell: Cell, difficulty: Difficulty, needsTop: boolean, needsBottom: boolean): boolean {
    if (!this.canAddRule(cell, difficulty)) return false;
    const halves = this.occupiedHalves(cell);
    if (needsTop && halves.top) return false;
    if (needsBottom && halves.bottom) return false;
    return true;
  }

  private clearTilesByType(grid: Grid, type: RuleTile['type']): void {
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        const cell = grid.cells[r][c];
        const rules = getCellRuleTiles(cell);
        if (rules.length === 0) continue;
        const remaining = rules.filter(rule => rule.type !== type);
        setCellRuleTiles(cell, remaining.length > 0 ? remaining : undefined);
      }
    }
  }

  private shuffle<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
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
      if (start >= minCol && end <= maxCol && start <= centerCol && end >= centerCol) {
        possibleStarts.push(start);
      }
    }

    const startCol = possibleStarts[Math.floor(Math.random() * possibleStarts.length)];
    const endCol = startCol + length - 1;

    return { startCol, endCol };
  }
}

export const puzzleGenerator = new PuzzleGenerator();
