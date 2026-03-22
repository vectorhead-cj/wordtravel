import React, { useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Dimensions,
  Pressable,
} from 'react-native';
import { Grid as GridType, GameMode, HintLevel } from '../engine/types';
import { SolveFromHereResult } from '../engine/DifficultySimulator';
import { countValidNextWords, getValidNextWords } from '../engine/HintEngine';
import { colors, layout } from '../theme';
import { CellView } from './CellView';
import { ErrorToast } from './ErrorToast';
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
  const textInputRef = useRef<TextInput>(null);

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

  const { cellSize, tileSize } = useMemo(() => {
    const screenWidth = Dimensions.get('window').width;
    const cell = Math.floor(screenWidth / layout.visibleColumns);
    const tile = cell - layout.tileSpacing;
    return { cellSize: cell, tileSize: tile };
  }, []);

  useEffect(() => {
    textInputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!currentPosition || validationFailed) return;
    const screenHeight = Dimensions.get('window').height;
    const rowYPosition = currentPosition.row * cellSize;
    const screenMiddle = screenHeight * 0.5;

    if (rowYPosition > screenMiddle) {
      const targetY = rowYPosition - screenHeight * 0.45;
      scrollViewRef.current?.scrollTo({ y: Math.max(0, targetY), animated: true });
    }
  }, [currentPosition, cellSize, validationFailed]);

  const badgeColumns = useMemo(() => {
    return grid.cells.map(row => {
      let lastAccessible = -1;
      for (let col = 0; col < row.length; col++) {
        if (row[col].accessible) lastAccessible = col;
      }
      return lastAccessible + 1 < grid.cols ? lastAccessible + 1 : -1;
    });
  }, [grid]);

  return (
    <View style={styles.container}>
      <Pressable style={{ flex: 1 }} onPress={() => textInputRef.current?.focus()}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            scrollContentTopInset > 0 && { paddingTop: scrollContentTopInset },
          ]}
          showsVerticalScrollIndicator={true}
        >
          <View style={{ width: cellSize * grid.cols, height: cellSize * grid.rows }}>
            {grid.cells.map((row, rowIndex) => (
              <View key={rowIndex} style={[styles.row, { width: cellSize * grid.cols }]}>
                {row.map((cell, colIndex) => {
                  const showBadge = colIndex === badgeColumns[rowIndex];
                  const hintData = showBadge ? hintDataPerRow[rowIndex] : null;

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
                      badgeCount={hintData?.count ?? null}
                      badgeExamples={hintData?.examples}
                      ghostLetter={ghostLetter}
                    />
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      </Pressable>

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
  hiddenInput: {
    position: 'absolute',
    top: -1000,
    left: 0,
    width: 1,
    height: 1,
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
