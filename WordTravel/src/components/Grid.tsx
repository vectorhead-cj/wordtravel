import React, { useRef, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { Grid as GridType, GameMode, HintLevel } from '../engine/types';
import { SolveFromHereResult } from '../engine/DifficultySimulator';
import { countValidNextWords, getValidNextWords } from '../engine/HintEngine';
import { colors, layout } from '../theme';
import { CellView } from './CellView';
import { ErrorToast } from './ErrorToast';
import { CustomKeyboard } from './CustomKeyboard';
import { useGridInput } from '../hooks/useGridInput';

interface GridProps {
  grid: GridType;
  mode: GameMode;
  onGridChange: (grid: GridType) => void;
  onRowValidated: (row: number, isValid: boolean) => void;
  hintLevel: HintLevel;
  solveOverlay?: SolveFromHereResult | null;
  scrollContentTopInset?: number;
}

const PUZZLE_GRID_PADDING = 8;
const HINT_AREA_WIDTH = 56;

export function Grid({
  grid,
  mode,
  onGridChange,
  onRowValidated,
  hintLevel,
  solveOverlay,
  scrollContentTopInset = 0,
}: GridProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  const [gridAreaLayout, setGridAreaLayout] = useState<{ width: number; height: number } | null>(null);

  const { currentPosition, errorMessage, validationFailed, handleKeyPress, handleBackspace } = useGridInput({
    grid,
    mode,
    onGridChange,
    onRowValidated,
  });

  const hintDataPerRow = useMemo(() => {
    if (hintLevel === 'off') {
      return grid.cells.map(() => ({ count: null as number | null, examples: undefined as string[] | undefined }));
    }
    if (hintLevel === 'count') {
      return grid.cells.map((_, rowIndex) => {
        const count = countValidNextWords(grid, rowIndex);
        return { count: count > 0 ? count : null, examples: undefined as string[] | undefined };
      });
    }
    return grid.cells.map((_, rowIndex) => {
      const { count, examples } = getValidNextWords(grid, rowIndex, 3);
      return {
        count: count > 0 ? count : null,
        examples: count > 0 ? examples : undefined,
      };
    });
  }, [grid, hintLevel]);

  const activeBounds = useMemo(() => {
    let minRow = grid.rows, maxRow = -1, minCol = grid.cols, maxCol = -1;
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        if (grid.cells[r][c].accessible) {
          minRow = Math.min(minRow, r);
          maxRow = Math.max(maxRow, r);
          minCol = Math.min(minCol, c);
          maxCol = Math.max(maxCol, c);
        }
      }
    }
    if (maxRow < 0) {
      return { minRow: 0, maxRow: 0, minCol: 0, maxCol: 0, activeRows: 0, activeCols: 0 };
    }
    return {
      minRow, maxRow, minCol, maxCol,
      activeRows: maxRow - minRow + 1,
      activeCols: maxCol - minCol + 1,
    };
  }, [grid]);

  const { cellSize, tileSize } = useMemo(() => {
    let cell: number;
    if (mode === 'puzzle' && gridAreaLayout && activeBounds.activeCols > 0) {
      const availWidth = gridAreaLayout.width - PUZZLE_GRID_PADDING * 2 - HINT_AREA_WIDTH;
      const availHeight = gridAreaLayout.height - PUZZLE_GRID_PADDING * 2;
      cell = Math.floor(Math.min(
        availWidth / activeBounds.activeCols,
        availHeight / activeBounds.activeRows,
      ));
    } else {
      const screenWidth = Dimensions.get('window').width;
      cell = Math.floor(screenWidth / layout.visibleColumns);
    }
    return { cellSize: cell, tileSize: cell - layout.tileSpacing };
  }, [mode, gridAreaLayout, activeBounds]);

  useEffect(() => {
    if (mode === 'puzzle' || !currentPosition || validationFailed) return;
    const screenHeight = Dimensions.get('window').height;
    const rowYPosition = (currentPosition.row - activeBounds.minRow) * cellSize;
    const screenMiddle = screenHeight * 0.5;

    if (rowYPosition > screenMiddle) {
      const targetY = rowYPosition - screenHeight * 0.45;
      scrollViewRef.current?.scrollTo({ y: Math.max(0, targetY), animated: true });
    }
  }, [mode, currentPosition, cellSize, validationFailed, activeBounds.minRow]);

  const renderGridContent = () => {
    const { minRow, maxRow, minCol, activeCols } = activeBounds;

    return (
      <View>
        {grid.cells.slice(minRow, maxRow + 1).map((row, i) => {
          const rowIndex = minRow + i;
          const hintData = hintDataPerRow[rowIndex];

          return (
            <View key={rowIndex} style={styles.gridRow}>
              <View style={[styles.cellsRow, { width: cellSize * activeCols }]}>
                {row.slice(minCol, minCol + activeCols).map((cell, j) => {
                  const colIndex = minCol + j;
                  const solvedCell = solveOverlay?.solution?.cells[rowIndex]?.[colIndex];
                  const ghostLetter = solvedCell?.letter && !cell.letter
                    ? solvedCell.letter
                    : undefined;

                  return (
                    <CellView
                      key={`${rowIndex}-${colIndex}`}
                      cell={cell}
                      cellSize={cellSize}
                      tileSize={tileSize}
                      ghostLetter={ghostLetter}
                    />
                  );
                })}
              </View>
              {hintData?.count != null && (
                <View style={styles.rowHint}>
                  <Text style={styles.hintCount}>{hintData.count}</Text>
                  {hintData.examples?.map((word, idx) => (
                    <Text key={idx} style={styles.hintExample} numberOfLines={1}>{word}</Text>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {mode === 'puzzle' ? (
        <>
          {scrollContentTopInset > 0 && <View style={{ height: scrollContentTopInset }} />}
          <View
            style={styles.puzzleArea}
            onLayout={(e) => {
              const { width, height } = e.nativeEvent.layout;
              setGridAreaLayout({ width, height });
            }}
          >
            {gridAreaLayout && renderGridContent()}
          </View>
        </>
      ) : (
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            scrollContentTopInset > 0 && { paddingTop: scrollContentTopInset },
          ]}
          showsVerticalScrollIndicator={true}
          keyboardShouldPersistTaps="handled"
        >
          {renderGridContent()}
        </ScrollView>
      )}

      {solveOverlay && (
        <View style={styles.solveStatContainer}>
          <Text style={styles.solveStatText}>
            Solvable: {(solveOverlay.successRate * 100).toFixed(1)}% (1000 runs)
          </Text>
          {!solveOverlay.solution && (
            <Text style={styles.solveStatNoSolution}>No solution found</Text>
          )}
        </View>
      )}

      <ErrorToast message={errorMessage} />

      <CustomKeyboard onKey={letter => handleKeyPress(letter)} onBackspace={handleBackspace} />

      <TextInput
        style={styles.hardwareInput}
        value=""
        onChangeText={handleKeyPress}
        onKeyPress={e => {
          if (e.nativeEvent.key === 'Backspace') {
            handleBackspace();
          }
        }}
        showSoftInputOnFocus={false}
        autoFocus
        autoCapitalize="characters"
        autoCorrect={false}
        keyboardType="ascii-capable"
        importantForAutofill="no"
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
  puzzleArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hardwareInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    left: 0,
    bottom: 0,
  },
  scrollContent: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cellsRow: {
    flexDirection: 'row',
  },
  rowHint: {
    paddingLeft: 6,
    justifyContent: 'center',
  },
  hintCount: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.ruleIndicatorNeutral,
  },
  hintExample: {
    fontSize: 9,
    color: colors.textMuted,
  },
  solveStatContainer: {
    position: 'absolute',
    top: 120,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  solveStatText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  solveStatNoSolution: {
    fontSize: 12,
    color: colors.ruleIndicatorNeutral,
    marginTop: 4,
  },
});
