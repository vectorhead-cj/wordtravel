export type GameMode = 'puzzle' | 'action';
export type PuzzleType = 'open' | 'bridge' | 'semi';
export type HintLevel = 'off' | 'count' | 'example';
export type SolveMode = 'off' | 'solve';
export type Difficulty = 'easy' | 'medium' | 'hard';

export type CellState = 'empty' | 'filled' | 'locked';
export type ValidationState = 'none' | 'correct' | 'incorrect';

export interface HardMatchTile {
  type: 'hardMatch';
  constraint: {
    pairedRow: number;
    pairedCol: number;
    position: 'top' | 'bottom';
  };
}

export type SoftForbiddenConstraint = {
  nextRow?: number;
  prevRow?: number;
};

export function softForbiddenTargetRows(c: SoftForbiddenConstraint): number[] {
  const rows: number[] = [];
  if (c.nextRow !== undefined) rows.push(c.nextRow);
  if (c.prevRow !== undefined) rows.push(c.prevRow);
  return rows;
}

export function isBidirectionalSoftForbidden(
  tile: SoftMatchTile | ForbiddenMatchTile,
): boolean {
  return tile.constraint.nextRow !== undefined && tile.constraint.prevRow !== undefined;
}

/** Row index of the bottom playable word line (last word slot). */
export function lastWordSlotRow(config: PuzzleConfig): number {
  if (config.wordSlots.length === 0) {
    throw new Error('PuzzleConfig has no word slots');
  }
  return config.wordSlots[config.wordSlots.length - 1].row;
}

/**
 * ModifierOverlay rotation for a unidirectional soft/forbidden tile.
 * 0 = default glyph direction (constraint toward next row); 180 = toward previous row.
 * Bidirectional tiles use stacked overlays in CellView — returns undefined.
 */
export function softForbiddenUnidirectionalRotation(
  tile: SoftMatchTile | ForbiddenMatchTile,
): 0 | 180 | undefined {
  if (isBidirectionalSoftForbidden(tile)) return undefined;
  if (tile.constraint.prevRow !== undefined) return 180;
  if (tile.constraint.nextRow !== undefined) return 0;
  return undefined;
}

export interface SoftMatchTile {
  type: 'softMatch';
  constraint: SoftForbiddenConstraint;
}

export interface ForbiddenMatchTile {
  type: 'forbiddenMatch';
  constraint: SoftForbiddenConstraint;
}

export type RuleTile = HardMatchTile | SoftMatchTile | ForbiddenMatchTile;

export interface Cell {
  letter: string | null;
  state: CellState;
  accessible: boolean;
  validation: ValidationState;
  /** @deprecated use ruleTiles */
  ruleTile?: RuleTile;
  ruleTiles?: RuleTile[];
  fixed?: boolean;
}

export interface WordSlot {
  row: number;
  length: number;
  startCol: number;
  endCol: number;
}

export interface PuzzleConfig {
  wordSlots: WordSlot[];
  rows: number;
  cols: number;
}

export interface Grid {
  rows: number;
  cols: number;
  cells: Cell[][];
}

export function cloneRuleTile(tile: RuleTile): RuleTile {
  return { ...tile, constraint: { ...tile.constraint } } as RuleTile;
}

export function getCellRuleTiles(cell: Cell): RuleTile[] {
  if (cell.ruleTiles) return cell.ruleTiles;
  if (cell.ruleTile) return [cell.ruleTile];
  return [];
}

export function getPrimaryRuleTile(cell: Cell): RuleTile | undefined {
  return cell.ruleTiles?.[0];
}

export function setCellRuleTiles(cell: Cell, tiles: RuleTile[] | undefined): void {
  if (!tiles || tiles.length === 0) {
    delete cell.ruleTile;
    delete cell.ruleTiles;
    return;
  }
  cell.ruleTile = cloneRuleTile(tiles[0]);
  cell.ruleTiles = tiles.map(cloneRuleTile);
}

export function addCellRuleTile(cell: Cell, tile: RuleTile): void {
  const current = getCellRuleTiles(cell);
  setCellRuleTiles(cell, [...current, tile]);
}

export function hasRuleType(cell: Cell, type: RuleTile['type']): boolean {
  return getCellRuleTiles(cell).some(tile => tile.type === type);
}

export function cloneGrid(grid: Grid): Grid {
  return {
    ...grid,
    cells: grid.cells.map(row =>
      row.map(cell => ({
        ...cell,
        ruleTile: cell.ruleTile ? cloneRuleTile(cell.ruleTile) : undefined,
        ruleTiles: cell.ruleTiles ? cell.ruleTiles.map(cloneRuleTile) : undefined,
      }))
    ),
  };
}

export interface GameState {
  mode: GameMode;
  grid: Grid;
  score: number;
  isComplete: boolean;
  isSuccess: boolean;
}

export interface GameResult {
  success: boolean;
  score: number;
  /** Snapshot of the grid after a successful puzzle solve (for results UI). */
  finalGrid?: Grid;
  timeElapsed?: number;
  uniqueLetterCount?: number;
  difficulty?: Difficulty;
  successRate?: number;
  averageWordFrequency?: number;
  backspaceCount?: number;
}

