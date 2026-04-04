import { useState, useMemo, useCallback } from 'react';
import { Grid, GameMode, cloneGrid } from '../engine/types';
import {
  isRowComplete,
  validateAndUpdateRow,
  getRowValidationState,
  RowValidationState,
} from '../engine/GameLogic';

function getErrorMessage(state: RowValidationState): string | null {
  if (!state.spelling) return null;
  if (!state.uniqueWords) return 'Word already used';
  if (state.hasHardMatchTile && !state.hardMatch) return '● rule not met';
  if (state.hasSoftMatchTile && !state.softMatch) return '○ rule not met';
  if (state.hasForbiddenMatchTile && !state.forbiddenMatch) return '− rule not met';
  return 'Invalid';
}

function findFirstEmptyCell(grid: Grid, mode: GameMode): { row: number; col: number } | null {
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const cell = grid.cells[row][col];
      if (!cell.accessible || cell.letter) continue;
      if (mode === 'action' && cell.validation !== 'none') continue;
      return { row, col };
    }
  }
  return null;
}

function findNextCell(
  grid: Grid,
  mode: GameMode,
  after: { row: number; col: number },
): { row: number; col: number } | null {
  for (let row = after.row; row < grid.rows; row++) {
    const startCol = row === after.row ? after.col + 1 : 0;
    for (let col = startCol; col < grid.cols; col++) {
      const cell = grid.cells[row][col];
      if (!cell.accessible || cell.fixed) continue;
      if (mode === 'action' && cell.validation !== 'none') continue;
      return { row, col };
    }
  }
  return null;
}

function findLastFilledCell(grid: Grid, mode: GameMode, before: { row: number; col: number } | null): { row: number; col: number } | null {
  let found: { row: number; col: number } | null = null;

  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      if (before && (row > before.row || (row === before.row && col >= before.col))) {
        return found;
      }
      const cell = grid.cells[row][col];
      if (!cell.accessible || !cell.letter || cell.fixed) continue;
      if (mode === 'action' && cell.validation !== 'none') continue;
      found = { row, col };
    }
  }

  return found;
}

interface UseGridInputParams {
  grid: Grid;
  mode: GameMode;
  readOnly?: boolean;
  onGridChange: (grid: Grid) => void;
  onRowValidated: (row: number, isValid: boolean) => void;
  onOverwriteApplied?: () => void;
}

export function useGridInput({
  grid,
  mode,
  readOnly = false,
  onGridChange,
  onRowValidated,
  onOverwriteApplied,
}: UseGridInputParams) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [manualPosition, setManualPosition] = useState<{ row: number; col: number } | null>(null);

  const autoPosition = useMemo(() => findFirstEmptyCell(grid, mode), [grid, mode]);

  const currentPosition = useMemo(() => {
    if (!manualPosition) return autoPosition;
    const cell = grid.cells[manualPosition.row]?.[manualPosition.col];
    if (!cell || !cell.accessible || cell.fixed) return autoPosition;
    if (mode === 'action' && cell.validation !== 'none') return autoPosition;
    return manualPosition;
  }, [manualPosition, autoPosition, grid, mode]);

  const showError = useCallback((message: string) => {
    setErrorMessage(message);
    setTimeout(() => setErrorMessage(null), 1000);
  }, []);

  const handleCellPress = useCallback((row: number, col: number) => {
    if (readOnly) return;
    const cell = grid.cells[row]?.[col];
    if (!cell || !cell.accessible || cell.fixed) return;
    if (mode === 'action' && cell.validation !== 'none') return;
    setManualPosition({ row, col });
  }, [readOnly, grid, mode]);

  const handleKeyPress = useCallback((text: string) => {
    if (readOnly) return;
    if (!text || text.length === 0 || !currentPosition) return;

    const letter = text.slice(-1).toUpperCase();
    if (!/^[A-Z]$/.test(letter)) return;

    const existingLetter = grid.cells[currentPosition.row][currentPosition.col].letter;
    if (existingLetter) {
      onOverwriteApplied?.();
    }

    const newGrid = cloneGrid(grid);
    newGrid.cells[currentPosition.row][currentPosition.col].letter = letter;
    newGrid.cells[currentPosition.row][currentPosition.col].state = 'filled';

    onGridChange(newGrid);

    const shouldValidate = isRowComplete(newGrid, currentPosition.row);
    if (shouldValidate) {
      const validationState = getRowValidationState(newGrid, currentPosition.row);
      const { validatedGrid, isValid } = validateAndUpdateRow(newGrid, currentPosition.row, mode);
      onGridChange(validatedGrid);
      onRowValidated(currentPosition.row, isValid);
      setManualPosition(null);

      if (!isValid) {
        const errorMsg = getErrorMessage(validationState);
        if (errorMsg) {
          showError(errorMsg);
        }
      }
    } else if (manualPosition) {
      setManualPosition(findNextCell(newGrid, mode, currentPosition));
    }
  }, [readOnly, grid, mode, currentPosition, manualPosition, onGridChange, onRowValidated, onOverwriteApplied, showError]);

  const handleBackspace = useCallback(() => {
    if (readOnly) return;
    const newGrid = cloneGrid(grid);

    const target = findLastFilledCell(grid, mode, currentPosition);
    if (!target) return;

    newGrid.cells[target.row][target.col].letter = '';
    newGrid.cells[target.row][target.col].state = 'empty';

    onGridChange(newGrid);
    onOverwriteApplied?.();
    if (manualPosition) {
      setManualPosition(target);
    }
  }, [readOnly, grid, mode, currentPosition, manualPosition, onGridChange, onOverwriteApplied]);

  return {
    currentPosition,
    errorMessage,
    handleKeyPress,
    handleBackspace,
    handleCellPress,
  };
}
