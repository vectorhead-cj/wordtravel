import React, { useRef, useEffect, useMemo, useState, forwardRef, useImperativeHandle } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, Dimensions, Animated, TouchableOpacity } from 'react-native';
import { Grid as GridType, GameMode, HintLevel, RuleTile, getCellRuleTiles, softForbiddenUnidirectionalRotation } from '../engine/types';
import { SolveFromHereResult } from '../engine/DifficultySimulator';
import {
  computeRuleFulfillment,
  getBrokenApplicableRuleCells,
  getRowEvaluationBlockers,
  getRowRuleSignalState,
  getRowValidationState,
  getWordFromRow,
} from '../engine/GameLogic';
import { countValidNextWords, getValidNextWords } from '../engine/HintEngine';
import { colors, layout } from '../theme';
import { CellView } from './CellView';
import { ErrorToast } from './ErrorToast';
import { CustomKeyboard } from './CustomKeyboard';
import { useGridInput } from '../hooks/useGridInput';

interface GridProps {
  grid: GridType;
  mode: GameMode;
  /** When true, input is disabled. Keyboard stays mounted if animation props are set. */
  readOnly?: boolean;
  onGridChange: (grid: GridType) => void;
  onRowValidated: (row: number, isValid: boolean) => void;
  onBackspaceApplied?: () => void;
  hintLevel: HintLevel;
  solveOverlay?: SolveFromHereResult | null;
  scrollContentTopInset?: number;
  /** Animated transform applied to the puzzle cell area (uniform zoom). */
  puzzleScale?: Animated.Value;
  puzzleTranslateY?: Animated.Value;
  /** Animated translateY for sliding the keyboard off-screen. */
  keyboardTranslateY?: Animated.Value;
}

export interface GridHandle {
  injectKey: (letter: string) => void;
}

const PUZZLE_GRID_PADDING = 8;
const HINT_AREA_WIDTH = 56;

export const Grid = forwardRef<GridHandle, GridProps>(function Grid({
  grid,
  mode,
  readOnly = false,
  onGridChange,
  onRowValidated,
  onBackspaceApplied,
  hintLevel,
  solveOverlay,
  scrollContentTopInset = 0,
  puzzleScale,
  puzzleTranslateY,
  keyboardTranslateY,
}, ref) {
  const scrollViewRef = useRef<ScrollView>(null);
  const [gridAreaLayout, setGridAreaLayout] = useState<{ width: number; height: number } | null>(null);
  const [signalMessage, setSignalMessage] = useState<string | null>(null);
  const [blinkTargets, setBlinkTargets] = useState<Set<string>>(new Set());
  const [blinkVisible, setBlinkVisible] = useState(false);
  const signalToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blinkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const blinkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { currentPosition, errorMessage, handleKeyPress, handleBackspace } = useGridInput({
    grid,
    mode,
    readOnly,
    onGridChange,
    onRowValidated,
    onBackspaceApplied,
  });

  const handleKeyPressRef = useRef(handleKeyPress);
  handleKeyPressRef.current = handleKeyPress;

  useImperativeHandle(ref, () => ({
    injectKey: (letter: string) => handleKeyPressRef.current(letter),
  }));

  const clearSignalToast = () => {
    if (signalToastTimeoutRef.current) {
      clearTimeout(signalToastTimeoutRef.current);
      signalToastTimeoutRef.current = null;
    }
  };

  const showSignalToast = (message: string) => {
    clearSignalToast();
    setSignalMessage(message);
    signalToastTimeoutRef.current = setTimeout(() => {
      setSignalMessage(null);
      signalToastTimeoutRef.current = null;
    }, 1200);
  };

  const clearBlinkTimers = () => {
    if (blinkIntervalRef.current) {
      clearInterval(blinkIntervalRef.current);
      blinkIntervalRef.current = null;
    }
    if (blinkTimeoutRef.current) {
      clearTimeout(blinkTimeoutRef.current);
      blinkTimeoutRef.current = null;
    }
  };

  const triggerRuleBlink = (cells: Array<{ row: number; col: number }>) => {
    clearBlinkTimers();
    if (cells.length === 0) {
      setBlinkTargets(new Set());
      setBlinkVisible(false);
      return;
    }

    setBlinkTargets(new Set(cells.map(c => `${c.row}-${c.col}`)));
    setBlinkVisible(true);
    let toggles = 0;
    blinkIntervalRef.current = setInterval(() => {
      toggles += 1;
      setBlinkVisible(prev => !prev);
      if (toggles >= 5) {
        clearBlinkTimers();
        setBlinkVisible(false);
        setBlinkTargets(new Set());
      }
    }, 140);
  };

  useEffect(() => {
    return () => {
      clearSignalToast();
      clearBlinkTimers();
    };
  }, []);

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
    if (mode === 'puzzle' || !currentPosition) return;
    const screenHeight = Dimensions.get('window').height;
    const rowYPosition = (currentPosition.row - activeBounds.minRow) * cellSize;
    const screenMiddle = screenHeight * 0.5;

    if (rowYPosition > screenMiddle) {
      const targetY = rowYPosition - screenHeight * 0.45;
      scrollViewRef.current?.scrollTo({ y: Math.max(0, targetY), animated: true });
    }
  }, [mode, currentPosition, cellSize, activeBounds.minRow]);

  const renderGridContent = () => {
    const { minRow, maxRow, minCol, activeCols } = activeBounds;

    return (
      <View>
        {grid.cells.slice(minRow, maxRow + 1).map((row, i) => {
          const rowIndex = minRow + i;
          const hintData = hintDataPerRow[rowIndex];
          const rowSignalState = getRowRuleSignalState(grid, rowIndex);

          return (
            <View key={rowIndex} style={styles.gridRow}>
              <View style={[styles.cellsRow, { width: cellSize * activeCols }]}>
                {row.slice(minCol, minCol + activeCols).map((cell, j) => {
                  const colIndex = minCol + j;
                  const solvedCell = solveOverlay?.solution?.cells[rowIndex]?.[colIndex];
                  const ghostLetter = solvedCell?.letter && !cell.letter
                    ? solvedCell.letter
                    : undefined;
                  const isActive = rowIndex === currentPosition?.row && colIndex === currentPosition?.col;
                  const fulfillment = computeRuleFulfillment(grid, rowIndex, colIndex);
                  const modifiers = getCellRuleTiles(cell).slice(0, 2).map(rule => {
                    const rotation: 0 | 180 = (() => {
                      if (rule.type === 'hardMatch' && rule.constraint.position === 'bottom') return 180;
                      if (rule.type === 'softMatch' || rule.type === 'forbiddenMatch') {
                        const r = softForbiddenUnidirectionalRotation(rule);
                        if (r !== undefined) return r;
                      }
                      return 0;
                    })();
                    return {
                      rule: rule as RuleTile,
                      fulfillment,
                      rotation,
                    };
                  });

                  return (
                    <CellView
                      key={`${rowIndex}-${colIndex}`}
                      cell={cell}
                      cellSize={cellSize}
                      tileSize={tileSize}
                      ghostLetter={ghostLetter}
                      active={isActive}
                      modifiers={modifiers}
                      blinkRuleStroke={blinkVisible && blinkTargets.has(`${rowIndex}-${colIndex}`)}
                    />
                  );
                })}
              </View>
              <TouchableOpacity
                style={styles.rowSignalArea}
                onPress={() => {
                  const blockers = getRowEvaluationBlockers(grid, rowIndex);
                  if (!blockers.rowComplete) {
                    showSignalToast('This row is not filled');
                    return;
                  }

                  if (!blockers.canEvaluate) {
                    const directions: string[] = [];
                    if (blockers.needsAbove) directions.push('above');
                    if (blockers.needsBelow) directions.push('below');
                    const locationText = directions.length > 0 ? directions.join(' and ') : 'around';
                    showSignalToast(`Fill row ${locationText} to evaluate this row`);
                    return;
                  }

                  const validation = getRowValidationState(grid, rowIndex);
                  const isInvalid =
                    !validation.spelling ||
                    !validation.hardMatch ||
                    !validation.softMatch ||
                    !validation.forbiddenMatch ||
                    !validation.noHardMatchForbiddenConflict ||
                    !validation.uniqueWords;

                  if (!isInvalid) return;

                  triggerRuleBlink(getBrokenApplicableRuleCells(grid, rowIndex));
                  if (!validation.spelling) {
                    const word = getWordFromRow(grid, rowIndex).toUpperCase();
                    showSignalToast(`${word} is not in dictionary`);
                  }
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Row ${rowIndex + 1} rule status`}
              >
                <View
                  style={[
                    styles.rowSignalDot,
                    rowSignalState === 'pending' && styles.rowSignalPending,
                    rowSignalState === 'valid' && styles.rowSignalValid,
                    rowSignalState === 'invalid' && styles.rowSignalInvalid,
                  ]}
                />
              </TouchableOpacity>
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

  const puzzleContent = (
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
  );

  return (
    <View style={styles.container} pointerEvents={readOnly ? 'box-none' : 'auto'}>
      {mode === 'puzzle' ? (
        puzzleScale ? (
          <Animated.View style={{
            flex: 1,
            transform: [
              { scale: puzzleScale },
              { translateY: puzzleTranslateY ?? 0 },
            ],
          }}>
            {puzzleContent}
          </Animated.View>
        ) : (
          puzzleContent
        )
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

      {!readOnly && solveOverlay && (
        <View style={styles.solveStatContainer}>
          <Text style={styles.solveStatText}>
            Solvable: {(solveOverlay.successRate * 100).toFixed(1)}% (1000 runs)
          </Text>
          {!solveOverlay.solution && (
            <Text style={styles.solveStatNoSolution}>No solution found</Text>
          )}
        </View>
      )}

      {(!readOnly || keyboardTranslateY != null) && (
        <Animated.View
          style={keyboardTranslateY ? { transform: [{ translateY: keyboardTranslateY }] } : undefined}
          pointerEvents={readOnly ? 'none' : 'auto'}
        >
          <CustomKeyboard onKey={letter => handleKeyPress(letter)} onBackspace={handleBackspace} />
        </Animated.View>
      )}

      <ErrorToast message={signalMessage} />

      {!readOnly && (
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
      )}
    </View>
  );
});

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
  rowSignalArea: {
    width: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
    marginRight: 2,
  },
  rowSignalDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.ruleIndicatorNeutral,
  },
  rowSignalPending: {
    backgroundColor: '#cbc4b5',
  },
  rowSignalValid: {
    backgroundColor: '#2fb65d',
    borderColor: '#2fb65d',
  },
  rowSignalInvalid: {
    backgroundColor: colors.ruleBroken,
    borderColor: colors.ruleBroken,
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
    top: 60,
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
