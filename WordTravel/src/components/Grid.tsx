import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  TextInput,
  ScrollView,
  StyleSheet,
  Dimensions,
  Text,
  Pressable,
} from 'react-native';
import { Grid as GridType, Cell, GameMode, HardMatchTile } from '../engine/types';
import { 
  isRowComplete, 
  validateAndUpdateRow, 
  getRowValidationState,
  countValidNextWords,
  RowValidationState 
} from '../engine/GameLogic';
import { colors, layout } from '../theme';

interface GridProps {
  grid: GridType;
  mode: GameMode;
  onGridChange: (grid: GridType) => void;
  onRowValidated: (row: number, isValid: boolean) => void;
  showRuleHelpers: boolean;
}

function getErrorMessage(state: RowValidationState): string {
  if (!state.spelling) return 'Not in dictionary';
  if (!state.uniqueWords) return 'Word already used';
  if (state.hasHardMatchTile && !state.hardMatch) return '● rule not met';
  if (state.hasSoftMatchTile && !state.softMatch) return '○ rule not met';
  if (state.hasForbiddenMatchTile && !state.forbiddenMatch) return '− rule not met';
  return 'Invalid';
}

function findFirstEmptyCell(grid: GridType, mode: GameMode): { row: number; col: number } | null {
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

function findLastFilledCell(grid: GridType, mode: GameMode, before: { row: number; col: number } | null): { row: number; col: number } | null {
  let found: { row: number; col: number } | null = null;

  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      if (before && (row > before.row || (row === before.row && col >= before.col))) {
        return found;
      }
      const cell = grid.cells[row][col];
      if (!cell.accessible || !cell.letter) continue;
      if (mode === 'action' && cell.validation !== 'none') continue;
      found = { row, col };
    }
  }

  return found;
}

export function Grid({ grid, mode, onGridChange, onRowValidated, showRuleHelpers: _showRuleHelpers }: GridProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [validationFailedRow, setValidationFailedRow] = useState<number | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const textInputRef = useRef<TextInput>(null);
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentPosition = useMemo(() => findFirstEmptyCell(grid, mode), [grid, mode]);

  const validNextWordCounts = useMemo(() => {
    const counts: (number | null)[] = grid.cells.map((_, rowIndex) => {
      const count = countValidNextWords(grid, rowIndex);
      return count > 0 ? count : null;
    });
    return counts;
  }, [grid]);

  const { cellSize, tileSize } = useMemo(() => {
    const screenWidth = Dimensions.get('window').width;
    const cell = Math.floor(screenWidth / layout.visibleColumns);
    const tile = cell - layout.tileSpacing;
    return { cellSize: cell, tileSize: tile };
  }, []);

  const showError = useCallback((message: string) => {
    if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    setErrorMessage(message);
    errorTimeoutRef.current = setTimeout(() => setErrorMessage(null), 1000);
  }, []);

  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    textInputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!currentPosition) return;
    const screenHeight = Dimensions.get('window').height;
    const rowYPosition = currentPosition.row * cellSize;
    const screenMiddle = screenHeight * 0.5;
    
    if (rowYPosition > screenMiddle) {
      const targetY = rowYPosition - screenHeight * 0.45;
      scrollViewRef.current?.scrollTo({ y: Math.max(0, targetY), animated: true });
    }
  }, [currentPosition, cellSize]);

  const handleKeyPress = (text: string) => {
    if (validationFailedRow !== null) return;
    if (!text || text.length === 0 || !currentPosition) return;

    const letter = text.slice(-1).toUpperCase();
    if (!/^[A-Z]$/.test(letter)) return;

    let newGrid = { ...grid };
    newGrid.cells = grid.cells.map(row => row.map(cell => ({ ...cell })));
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
  };

  const handleBackspace = () => {
    let newGrid = { ...grid };
    newGrid.cells = grid.cells.map(row => row.map(cell => ({ ...cell })));

    if (validationFailedRow !== null) {
      // Reset validation on the failed row
      for (let col = 0; col < newGrid.cols; col++) {
        if (newGrid.cells[validationFailedRow][col].accessible) {
          newGrid.cells[validationFailedRow][col].validation = 'none';
        }
      }
      // Remove the last filled letter in that row
      for (let col = newGrid.cols - 1; col >= 0; col--) {
        const cell = newGrid.cells[validationFailedRow][col];
        if (cell.accessible && cell.letter) {
          cell.letter = '';
          cell.state = 'empty';
          break;
        }
      }
      setValidationFailedRow(null);
      onGridChange(newGrid);
      return;
    }

    const target = findLastFilledCell(grid, mode, currentPosition);
    if (!target) return;

    newGrid.cells[target.row][target.col].letter = '';
    newGrid.cells[target.row][target.col].state = 'empty';

    onGridChange(newGrid);
  };

  const handleTapGrid = () => {
    textInputRef.current?.focus();
  };

  const badgeColumns = useMemo(() => {
    return grid.cells.map(row => {
      let lastAccessible = -1;
      for (let col = 0; col < row.length; col++) {
        if (row[col].accessible) lastAccessible = col;
      }
      return lastAccessible + 1 < grid.cols ? lastAccessible + 1 : -1;
    });
  }, [grid]);

  const renderCell = (cell: Cell, row: number, col: number) => {
    const ruleTile = cell.ruleTile;
    const showFilledCircle = ruleTile?.type === 'hardMatch' && 
      (ruleTile as HardMatchTile).constraint.position === 'top';
    const showHollowCircle = ruleTile?.type === 'softMatch';
    const showForbidden = ruleTile?.type === 'forbiddenMatch';

    const showBadgeHere = col === badgeColumns[row];
    const badgeCount = showBadgeHere ? validNextWordCounts[row] : null;

    if (!cell.accessible) {
      if (showBadgeHere) {
        return (
          <View
            key={`${row}-${col}`}
            style={{ width: cellSize, height: cellSize, justifyContent: 'center', alignItems: 'flex-start', paddingLeft: 4 }}
          >
            <Text style={styles.wordCountBadge}>
              {badgeCount ?? '-'}
            </Text>
          </View>
        );
      }
      return (
        <View
          key={`${row}-${col}`}
          style={{ width: cellSize, height: cellSize }}
        />
      );
    }
    
    return (
      <View
        key={`${row}-${col}`}
        style={[
          styles.cellOuter,
          { width: cellSize, height: cellSize },
        ]}
      >
        <View
          style={[
            styles.tile,
            { width: tileSize, height: tileSize, borderRadius: layout.tileCornerRadius },
          ]}
        >
          <View style={styles.cellContent}>
            {cell.letter && (
              <View style={styles.letterContainer}>
                <TextInput
                  style={styles.letter}
                  value={cell.letter}
                  editable={false}
                />
              </View>
            )}
            {showFilledCircle && (
              <Text style={styles.ruleIndicator}>●</Text>
            )}
            {showHollowCircle && (
              <Text style={styles.ruleIndicator}>○</Text>
            )}
            {showForbidden && (
              <Text style={styles.ruleIndicator}>−</Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Pressable style={{ flex: 1 }} onPress={handleTapGrid}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
        >
          <View style={{ width: cellSize * grid.cols, height: cellSize * grid.rows }}>
            {grid.cells.map((row, rowIndex) => (
              <View key={rowIndex} style={[styles.row, { width: cellSize * grid.cols }]}>
                {row.map((cell, colIndex) => renderCell(cell, rowIndex, colIndex))}
              </View>
            ))}
          </View>
        </ScrollView>
      </Pressable>

      {errorMessage && (
        <View style={styles.errorPopup}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      <TextInput
        ref={textInputRef}
        style={styles.hiddenInput}
        onChangeText={handleKeyPress}
        onKeyPress={(e) => {
          if (e.nativeEvent.key === 'Backspace') {
            handleBackspace();
          }
        }}
        value=""
        autoCapitalize="characters"
        autoCorrect={false}
        keyboardType="default"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
  },
  wordCountBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.ruleIndicatorNeutral,
  },
  cellOuter: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  tile: {
    backgroundColor: colors.tile,
    borderWidth: layout.tileBorderWidth,
    borderColor: colors.tileStroke,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cellContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  letterContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  letter: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.letterDefault,
    textAlign: 'center',
  },
  ruleIndicator: {
    position: 'absolute',
    bottom: 2,
    fontSize: 8,
    fontWeight: 'bold',
    color: colors.ruleIndicatorNeutral,
  },
  errorPopup: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  hiddenInput: {
    position: 'absolute',
    top: -1000,
    left: 0,
    width: 1,
    height: 1,
  },
});
