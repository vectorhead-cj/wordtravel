import {
  Grid,
  Cell,
  PuzzleConfig,
  WordSlot,
  PuzzleType,
  Difficulty,
  RuleTile,
  SoftForbiddenConstraint,
  addCellRuleTile,
  getCellRuleTiles,
  setCellRuleTiles,
  softForbiddenTargetRows,
  lastWordSlotRow,
  cloneGrid,
} from './types';
import { PUZZLE_CONFIG, GENERATION_PROFILES, GenerationProfile } from './config';
import { generatorDictionary, ConstraintQuery } from './Dictionary';
import { serializeGrid } from './PuzzleNotation';
import { simulatePuzzleDifficulty, classifyDifficulty } from './DifficultySimulator';

const DIFFICULTY_ORDER: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2 };
const MAX_TUNE_ROUNDS = 8;
const MODIFIERS_PER_ROUND = 2;

export interface GeneratedPuzzle {
  puzzle: string;
  difficulty: Difficulty;
  successRate: number;
}

export class PuzzleGenerator {
  generatePuzzle(puzzleType: PuzzleType = 'open', targetDifficulty?: Difficulty): GeneratedPuzzle {
    const maxAttempts = 500;
    const difficulty = targetDifficulty ?? 'medium';
    const profile = GENERATION_PROFILES[difficulty];

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const result = this.generateAndTune(puzzleType, profile, difficulty);
      if (result) return result;
    }
    throw new Error(`Failed to generate puzzle after ${maxAttempts} attempts`);
  }

  /** Generate a validated grid without running difficulty simulation. */
  generateGrid(puzzleType: PuzzleType = 'open', difficulty: Difficulty = 'medium', maxAttempts = 200): Grid {
    const profile = GENERATION_PROFILES[difficulty];
    for (let i = 0; i < maxAttempts; i++) {
      const grid = this.generateStaged(puzzleType, profile);
      if (grid) return grid;
    }
    throw new Error(`Failed to generate valid grid in ${maxAttempts} attempts`);
  }

  /**
   * Generate a base grid, then iteratively add modifiers until the target
   * difficulty is reached. Returns null if the grid is unsalvageable (too hard
   * or can't accept more modifiers).
   */
  private generateAndTune(
    puzzleType: PuzzleType,
    profile: GenerationProfile,
    targetDifficulty: Difficulty,
  ): GeneratedPuzzle | null {
    const baseGrid = this.generateStaged(puzzleType, profile);
    if (!baseGrid) return null;

    // We need config to add modifiers — regenerate it from the grid
    const config = this.configFromGrid(baseGrid);

    let grid = baseGrid;

    for (let round = 0; round <= MAX_TUNE_ROUNDS; round++) {
      const sim = simulatePuzzleDifficulty(grid);
      if (sim.difficulty === null) return null; // unsolvable

      if (sim.difficulty === targetDifficulty) {
        return {
          puzzle: serializeGrid(grid),
          difficulty: sim.difficulty,
          successRate: sim.successRate,
        };
      }

      // Current difficulty is harder than target — can't make it easier, restart
      if (DIFFICULTY_ORDER[sim.difficulty] > DIFFICULTY_ORDER[targetDifficulty]) {
        return null;
      }

      // Too easy — try adding modifiers to increase difficulty
      if (round === MAX_TUNE_ROUNDS) return null; // exhausted tuning budget

      const snapshot = cloneGrid(grid);
      let added = 0;
      for (let i = 0; i < MODIFIERS_PER_ROUND; i++) {
        if (this.tryAddRandomModifier(grid, config, profile)) {
          added++;
        }
      }

      if (added === 0) return null; // no room for more modifiers

      // Validate the modified grid; roll back if invalid
      if (!this.fullValidation(grid, config, profile)) {
        grid = snapshot;
        return null;
      }
    }

    return null;
  }

  private generateStaged(
    puzzleType: PuzzleType,
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
      this.placeHardMatchChains(grid, config, profile);
      hardOk = this.validateAfterHardMatch(grid, config, profile);
    }
    if (!hardOk) return null;

    // Stage 5: place soft/forbidden tiles with local retry
    let softOk = false;
    for (let i = 0; i < 5 && !softOk; i++) {
      this.clearTilesByType(grid, 'softMatch');
      this.clearTilesByType(grid, 'forbiddenMatch');
      this.placeSoftForbiddenTiles(grid, config, profile, 'softMatch', profile.minSoftMatchModifiers);
      this.placeSoftForbiddenTiles(grid, config, profile, 'forbiddenMatch', profile.minForbiddenModifiers);
      softOk = this.validateRuleConflicts(grid) &&
               this.validateDictionaryFeasibility(grid, config, profile.minCandidatesPerRow) &&
               this.validateForbiddenGrouping(grid, config, profile.minForbiddenGroupSize);
    }
    if (!softOk) return null;

    // Stage 6: ensure minimums
    this.ensureMinimumRuleTiles(grid, config, profile);

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
  ): void {
    let remainingConnections = profile.minHardMatchPairs;
    const maxAttempts = 100;
    let attempts = 0;

    while (remainingConnections > 0 && attempts < maxAttempts) {
      attempts++;

      const desiredLength = Math.min(profile.hardMatchMaxChainLength, remainingConnections + 1);

      // Try desired length, then fall back to shorter chains
      let placed = false;
      for (let chainLen = desiredLength; chainLen >= 2 && !placed; chainLen--) {
        placed = this.tryPlaceChain(grid, config, profile, chainLen);
        if (placed) {
          remainingConnections -= (chainLen - 1);
        }
      }
    }
  }

  private tryPlaceChain(
    grid: Grid,
    config: PuzzleConfig,
    profile: GenerationProfile,
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
        if (!this.canAddRuleWithHalves(cell, profile, needsTop, needsBottom)) return false;
      } else {
        // Middle cell needs 2 rule slots + both halves free
        if (getCellRuleTiles(cell).length + 2 > this.maxRulesPerCell(profile)) return false;
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
    profile: GenerationProfile,
    tileType: 'softMatch' | 'forbiddenMatch',
    targetCount: number,
  ): void {
    const bidirectional = profile.permittedSoftAndForbiddenDirections === 'bidirectional';
    let placed = 0;
    const maxAttempts = 100;
    let attempts = 0;

    while (placed < targetCount && attempts < maxAttempts) {
      attempts++;

      const randomRow = Math.floor(Math.random() * config.rows);
      const randomCol = Math.floor(Math.random() * config.cols);

      const cell = grid.cells[randomRow][randomCol];
      if (!cell.accessible) continue;

      // Skip cells in fully-fixed rows unless the profile allows it
      if (!profile.fixedWordRowsMayHaveNonHardModifiers && this.isFullyFixedRow(grid, randomRow)) continue;

      // Forbidden tiles must not be the sole modifier type on a row (grouping rule).
      // Only place forbidden on rows that already have a non-forbidden modifier.
      if (tileType === 'forbiddenMatch' && !this.rowHasNonForbiddenModifier(grid, randomRow)) continue;

      const { canPointDown, hasPrevRow } = this.getRowDirectionality(grid, config, randomRow);

      let constraint: SoftForbiddenConstraint;
      let needsTop: boolean;
      let needsBottom: boolean;

      if (!bidirectional) {
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

      if (!this.canAddRuleWithHalves(cell, profile, needsTop, needsBottom)) continue;

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
  ): void {
    const min = profile.minModifiersPerRow;
    if (min <= 0) return;

    const bidirectional = profile.permittedSoftAndForbiddenDirections === 'bidirectional';

    for (const slot of config.wordSlots) {
      const isFixed = this.isFullyFixedRow(grid, slot.row);
      if (isFixed && !profile.fixedWordRowsMayHaveNonHardModifiers) continue;

      let deficit = min - this.countRuleTilesInRow(grid, slot.row);

      for (let col = slot.startCol; col <= slot.endCol && deficit > 0; col++) {
        const cell = grid.cells[slot.row][col];
        if (!cell.accessible) continue;

        // Build weighted list of types to try
        const candidates: Array<'hardMatch' | 'softMatch' | 'forbiddenMatch'> = [];
        if (!cell.fixed) {
          for (let i = 0; i < profile.minHardMatchPairs; i++) candidates.push('hardMatch');
        }
        for (let i = 0; i < profile.minSoftMatchModifiers; i++) candidates.push('softMatch');
        for (let i = 0; i < profile.minForbiddenModifiers; i++) candidates.push('forbiddenMatch');

        this.shuffle(candidates);

        const tried = new Set<string>();
        let placed = false;
        for (const type of candidates) {
          if (tried.has(type)) continue;
          tried.add(type);

          if (type === 'hardMatch') {
            placed = this.tryPlaceHardMatchBackfill(grid, slot, col, profile);
          } else {
            placed = this.tryPlaceSoftOrForbiddenBackfill(grid, config, slot, col, profile, type, bidirectional);
          }
          if (placed) break;
        }

        if (placed) deficit--;
      }
    }

    // Second pass: ensure every adjacent-row boundary has a constraint crossing it
    this.ensureBoundaryCoverage(grid, config, profile, bidirectional);
  }

  /**
   * For each uncovered adjacent-row boundary, try to place a modifier that
   * crosses it. Tries from the upper row pointing down first, then from the
   * lower row (hard match up, or bidirectional soft/forbidden).
   */
  private ensureBoundaryCoverage(
    grid: Grid,
    config: PuzzleConfig,
    profile: GenerationProfile,
    bidirectional: boolean,
  ): void {
    for (let i = 1; i < config.wordSlots.length; i++) {
      const slotA = config.wordSlots[i - 1];
      const slotB = config.wordSlots[i];

      // Skip boundaries adjacent to fully-fixed rows when not allowed
      if (!profile.fixedWordRowsMayHaveNonHardModifiers) {
        if (this.isFullyFixedRow(grid, slotA.row) || this.isFullyFixedRow(grid, slotB.row)) continue;
      }

      if (this.boundaryHasConstraint(grid, slotA.row, slotB.row)) continue;

      // Try placing a downward modifier on row A
      if (this.tryPlaceBoundaryCrossing(grid, config, slotA, slotB, profile, bidirectional)) continue;

      // Try placing an upward hard match on row B → row A
      this.tryPlaceUpwardHardMatchBackfill(grid, slotB, slotA, profile);
    }
  }

  /** Try to place any modifier on slotA that targets slotB's row. */
  private tryPlaceBoundaryCrossing(
    grid: Grid, config: PuzzleConfig,
    slotA: WordSlot, slotB: WordSlot,
    profile: GenerationProfile, bidirectional: boolean,
  ): boolean {
    const isFixedA = this.isFullyFixedRow(grid, slotA.row);
    if (isFixedA && !profile.fixedWordRowsMayHaveNonHardModifiers) return false;

    const cols = this.shuffledRange(slotA.startCol, slotA.endCol);
    for (const col of cols) {
      const cell = grid.cells[slotA.row][col];
      if (!cell.accessible) continue;

      // Try hard match (downward from A to B) — must not be on fixed cells
      if (!cell.fixed && grid.cells[slotB.row][col]?.accessible && !grid.cells[slotB.row][col].fixed) {
        if (this.tryPlaceHardMatchBackfill(grid, slotA, col, profile)) return true;
      }

      // Try soft or forbidden pointing down
      const types: Array<'softMatch' | 'forbiddenMatch'> = Math.random() < 0.5
        ? ['softMatch', 'forbiddenMatch']
        : ['forbiddenMatch', 'softMatch'];
      for (const tileType of types) {
        if (this.tryPlaceSoftOrForbiddenBackfill(grid, config, slotA, col, profile, tileType, bidirectional)) return true;
      }
    }
    return false;
  }

  /** Try to place a hard match on slotB pointing up to slotA. */
  private tryPlaceUpwardHardMatchBackfill(
    grid: Grid, slotB: WordSlot, slotA: WordSlot,
    profile: GenerationProfile,
  ): boolean {
    const cols = this.shuffledRange(slotB.startCol, slotB.endCol);
    for (const col of cols) {
      const cellB = grid.cells[slotB.row][col];
      const cellA = grid.cells[slotA.row]?.[col];
      if (!cellB.accessible || cellB.fixed || !cellA?.accessible || cellA.fixed) continue;
      if (!this.canAddRuleWithHalves(cellB, profile, true, false)) continue;
      if (!this.canAddRuleWithHalves(cellA, profile, false, true)) continue;

      addCellRuleTile(cellB, {
        type: 'hardMatch',
        constraint: { pairedRow: slotA.row, pairedCol: col, position: 'bottom' },
      });
      addCellRuleTile(cellA, {
        type: 'hardMatch',
        constraint: { pairedRow: slotB.row, pairedCol: col, position: 'top' },
      });
      return true;
    }
    return false;
  }

  private shuffledRange(start: number, end: number): number[] {
    const arr: number[] = [];
    for (let i = start; i <= end; i++) arr.push(i);
    this.shuffle(arr);
    return arr;
  }

  private tryPlaceHardMatchBackfill(
    grid: Grid, slot: WordSlot, col: number, profile: GenerationProfile,
  ): boolean {
    if (slot.row + 1 >= grid.rows) return false;
    const cell = grid.cells[slot.row][col];
    const below = grid.cells[slot.row + 1][col];
    if (!below.accessible || cell.fixed || below.fixed) return false;
    if (!this.canAddRuleWithHalves(cell, profile, false, true)) return false;
    if (!this.canAddRuleWithHalves(below, profile, true, false)) return false;

    addCellRuleTile(cell, {
      type: 'hardMatch',
      constraint: { pairedRow: slot.row + 1, pairedCol: col, position: 'top' },
    });
    addCellRuleTile(below, {
      type: 'hardMatch',
      constraint: { pairedRow: slot.row, pairedCol: col, position: 'bottom' },
    });
    return true;
  }

  private tryPlaceSoftOrForbiddenBackfill(
    grid: Grid, config: PuzzleConfig, slot: WordSlot, col: number,
    profile: GenerationProfile, tileType: 'softMatch' | 'forbiddenMatch',
    bidirectional: boolean,
  ): boolean {
    // Forbidden must not be the sole modifier type on a row
    if (tileType === 'forbiddenMatch' && !this.rowHasNonForbiddenModifier(grid, slot.row)) return false;

    const cell = grid.cells[slot.row][col];
    const { canPointDown, hasPrevRow } = this.getRowDirectionality(grid, config, slot.row);
    if (!canPointDown) return false;

    const useBidirectional = bidirectional && hasPrevRow;
    const needsTop = useBidirectional;
    const needsBottom = true;
    if (!this.canAddRuleWithHalves(cell, profile, needsTop, needsBottom)) return false;

    if (tileType === 'softMatch' && cell.fixed && cell.letter) {
      const constraint = useBidirectional
        ? { nextRow: slot.row + 1, prevRow: slot.row - 1 }
        : { nextRow: slot.row + 1 };
      if (this.isTrivialSoftConstraint(grid, cell.letter, constraint)) return false;
    }

    addCellRuleTile(cell, {
      type: tileType,
      constraint: useBidirectional
        ? { nextRow: slot.row + 1, prevRow: slot.row - 1 }
        : { nextRow: slot.row + 1 },
    });
    return true;
  }

  private countRuleTilesInRow(grid: Grid, row: number): number {
    let count = 0;
    for (let col = 0; col < grid.cols; col++) {
      const cell = grid.cells[row][col];
      if (!cell.accessible) continue;
      const rules = getCellRuleTiles(cell);
      if (rules.some(r => r.type === 'hardMatch')) {
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
  // Difficulty tuning: add modifiers one at a time
  // ---------------------------------------------------------------------------

  /**
   * Try to place one random soft or forbidden modifier on an eligible cell.
   * Returns true if a modifier was placed and feasibility still holds.
   */
  private tryAddRandomModifier(
    grid: Grid,
    config: PuzzleConfig,
    profile: GenerationProfile,
  ): boolean {
    const bidirectional = profile.permittedSoftAndForbiddenDirections === 'bidirectional';
    const tileType: 'softMatch' | 'forbiddenMatch' = Math.random() < 0.6 ? 'softMatch' : 'forbiddenMatch';

    const maxAttempts = 50;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const randomRow = Math.floor(Math.random() * config.rows);
      const randomCol = Math.floor(Math.random() * config.cols);
      const cell = grid.cells[randomRow][randomCol];
      if (!cell.accessible) continue;

      // Skip cells in fully-fixed rows unless the profile allows it
      if (!profile.fixedWordRowsMayHaveNonHardModifiers && this.isFullyFixedRow(grid, randomRow)) continue;

      // Forbidden tiles must not be the sole modifier type on a row
      if (tileType === 'forbiddenMatch' && !this.rowHasNonForbiddenModifier(grid, randomRow)) continue;

      const { canPointDown, hasPrevRow } = this.getRowDirectionality(grid, config, randomRow);

      let constraint: SoftForbiddenConstraint;
      let needsTop: boolean;
      let needsBottom: boolean;

      if (!bidirectional) {
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

      if (!this.canAddRuleWithHalves(cell, profile, needsTop, needsBottom)) continue;

      if (tileType === 'softMatch' && cell.fixed && cell.letter) {
        if (this.isTrivialSoftConstraint(grid, cell.letter, constraint)) continue;
      }

      // Tentatively place the modifier
      const tile: RuleTile = { type: tileType, constraint: { ...constraint } } as RuleTile;
      addCellRuleTile(cell, tile);

      // Check feasibility still holds; roll back if not
      if (!this.validateRuleConflicts(grid) ||
          !this.validateDictionaryFeasibility(grid, config, profile.minCandidatesPerRow)) {
        const rules = getCellRuleTiles(cell);
        setCellRuleTiles(cell, rules.filter(r => r !== tile));
        continue;
      }

      return true;
    }
    return false;
  }

  /** Reconstruct a PuzzleConfig from an already-built grid. */
  private configFromGrid(grid: Grid): PuzzleConfig {
    const wordSlots: WordSlot[] = [];
    for (let row = 0; row < grid.rows; row++) {
      let startCol = -1;
      let endCol = -1;
      for (let col = 0; col < grid.cols; col++) {
        if (grid.cells[row][col].accessible) {
          if (startCol === -1) startCol = col;
          endCol = col;
        }
      }
      if (startCol !== -1) {
        wordSlots.push({ row, length: endCol - startCol + 1, startCol, endCol });
      }
    }
    return { wordSlots, rows: grid.rows, cols: grid.cols };
  }

  // ---------------------------------------------------------------------------
  // Stage 7: Validation
  // ---------------------------------------------------------------------------

  private fullValidation(grid: Grid, config: PuzzleConfig, profile: GenerationProfile): boolean {
    return this.validateRuleConflicts(grid) &&
           this.validateDictionaryFeasibility(grid, config, profile.minCandidatesPerRow) &&
           this.validateForbiddenGrouping(grid, config, profile.minForbiddenGroupSize) &&
           this.validateMinModifiersPerRow(grid, config, profile) &&
           this.validateAdjacentRowConnectivity(grid, config, profile);
  }

  private validateMinModifiersPerRow(grid: Grid, config: PuzzleConfig, profile: GenerationProfile): boolean {
    if (profile.minModifiersPerRow <= 0) return true;
    for (const slot of config.wordSlots) {
      // Exempt fully-fixed rows only when the profile doesn't allow non-hard modifiers on them
      if (!profile.fixedWordRowsMayHaveNonHardModifiers && this.isFullyFixedRow(grid, slot.row)) continue;
      if (this.countRuleTilesInRow(grid, slot.row) < profile.minModifiersPerRow) return false;
    }
    return true;
  }

  /**
   * Every pair of adjacent word rows must have at least one constraint crossing
   * the boundary — either row A constraining row B, or row B constraining row A.
   * Boundaries adjacent to fully-fixed rows are exempt when the profile doesn't
   * allow non-hard modifiers on them (since hard matches can't be placed on
   * fixed cells either).
   */
  private validateAdjacentRowConnectivity(grid: Grid, config: PuzzleConfig, profile?: GenerationProfile): boolean {
    for (let i = 1; i < config.wordSlots.length; i++) {
      const rowA = config.wordSlots[i - 1].row;
      const rowB = config.wordSlots[i].row;

      // Skip boundaries where one side is a fully-fixed row that can't carry modifiers
      if (profile && !profile.fixedWordRowsMayHaveNonHardModifiers) {
        if (this.isFullyFixedRow(grid, rowA) || this.isFullyFixedRow(grid, rowB)) continue;
      }

      if (!this.boundaryHasConstraint(grid, rowA, rowB)) return false;
    }
    return true;
  }

  /** Check whether any modifier crosses the boundary between rowA and rowB. */
  private boundaryHasConstraint(grid: Grid, rowA: number, rowB: number): boolean {
    // Check row A for modifiers targeting row B
    for (let c = 0; c < grid.cols; c++) {
      const cell = grid.cells[rowA][c];
      if (!cell.accessible) continue;
      for (const rule of getCellRuleTiles(cell)) {
        if (rule.type === 'hardMatch' && rule.constraint.pairedRow === rowB) return true;
        if ((rule.type === 'softMatch' || rule.type === 'forbiddenMatch') &&
            softForbiddenTargetRows(rule.constraint).includes(rowB)) return true;
      }
    }
    // Check row B for modifiers targeting row A
    for (let c = 0; c < grid.cols; c++) {
      const cell = grid.cells[rowB][c];
      if (!cell.accessible) continue;
      for (const rule of getCellRuleTiles(cell)) {
        if (rule.type === 'hardMatch' && rule.constraint.pairedRow === rowA) return true;
        if ((rule.type === 'softMatch' || rule.type === 'forbiddenMatch') &&
            softForbiddenTargetRows(rule.constraint).includes(rowA)) return true;
      }
    }
    return false;
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

  private rowHasNonForbiddenModifier(grid: Grid, row: number): boolean {
    for (let col = 0; col < grid.cols; col++) {
      const cell = grid.cells[row][col];
      if (!cell.accessible) continue;
      for (const rule of getCellRuleTiles(cell)) {
        if (rule.type === 'hardMatch' || rule.type === 'softMatch') return true;
      }
    }
    return false;
  }

  private isFullyFixedRow(grid: Grid, row: number): boolean {
    return grid.cells[row]
      .filter(c => c.accessible)
      .every(c => c.fixed);
  }

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

  private maxRulesPerCell(profile: GenerationProfile): number {
    return profile.maxRulesPerCell;
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

  private canAddRule(cell: Cell, profile: GenerationProfile): boolean {
    return getCellRuleTiles(cell).length < this.maxRulesPerCell(profile);
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
  private canAddRuleWithHalves(cell: Cell, profile: GenerationProfile, needsTop: boolean, needsBottom: boolean): boolean {
    if (!this.canAddRule(cell, profile)) return false;
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
