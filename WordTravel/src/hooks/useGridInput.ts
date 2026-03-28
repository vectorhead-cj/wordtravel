import { useState, useMemo, useCallback } from 'react';
import { Grid, GameMode, cloneGrid } from '../engine/types';
import {
  isRowComplete,
  validateAndUpdateRow,
  getRowValidationState,
  RowValidationState,
} from '../engine/GameLogic';

function getErrorMessage(state: RowValidationState): string {
  if (!state.spelling) return 'Not in dictionary';
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
  onBackspaceApplied?: () => void;
}

export function useGridInput({
  grid,
  mode,
  readOnly = false,
  onGridChange,
  onRowValidated,
  onBackspaceApplied,
}: UseGridInputParams) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [validationFailedRow, setValidationFailedRow] = useState<number | null>(null);

  const currentPosition = useMemo(() => findFirstEmptyCell(grid, mode), [grid, mode]);

  const showError = useCallback((message: string) => {
    setErrorMessage(message);
    setTimeout(() => setErrorMessage(null), 1000);
  }, []);

  const handleKeyPress = useCallback((text: string) => {
    if (readOnly) return;
    if (validationFailedRow !== null) return;
    if (!text || text.length === 0 || !currentPosition) return;

    const letter = text.slice(-1).toUpperCase();
    if (!/^[A-Z]$/.test(letter)) return;

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

      if (!isValid) {
        setValidationFailedRow(currentPosition.row);
        showError(getErrorMessage(validationState));
      }
    }
  }, [readOnly, grid, mode, currentPosition, validationFailedRow, onGridChange, onRowValidated, showError]);

  const handleBackspace = useCallback(() => {
    if (readOnly) return;
    const newGrid = cloneGrid(grid);

    if (validationFailedRow !== null) {
      for (let col = 0; col < newGrid.cols; col++) {
        if (newGrid.cells[validationFailedRow][col].accessible) {
          newGrid.cells[validationFailedRow][col].validation = 'none';
        }
      }
      for (let col = newGrid.cols - 1; col >= 0; col--) {
        const cell = newGrid.cells[validationFailedRow][col];
        if (cell.accessible && cell.letter && !cell.fixed) {
          cell.letter = '';
          cell.state = 'empty';
          break;
        }
      }
      setValidationFailedRow(null);
      onGridChange(newGrid);
      onBackspaceApplied?.();
      return;
    }

    const target = findLastFilledCell(grid, mode, currentPosition);
    if (!target) return;

    newGrid.cells[target.row][target.col].letter = '';
    newGrid.cells[target.row][target.col].state = 'empty';

    onGridChange(newGrid);
    onBackspaceApplied?.();
  }, [readOnly, grid, mode, currentPosition, validationFailedRow, onGridChange, onBackspaceApplied]);

  return {
    currentPosition,
    errorMessage,
    validationFailed: validationFailedRow !== null,
    handleKeyPress,
    handleBackspace,
  };
}

