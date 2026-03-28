import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameMode, GameResult, PuzzleType, Difficulty, Grid as GridType, HintLevel, SolveMode, cloneGrid } from '../engine/types';
import { Grid, GridHandle } from '../components/Grid';
import { createMockGrid } from '../engine/mockData';
import { puzzleGenerator, GeneratedPuzzle } from '../engine/PuzzleGenerator';
import { parseGrid } from '../engine/PuzzleNotation';
import { solveFromHere, SolveFromHereResult } from '../engine/DifficultySimulator';
import { getWordFromRow } from '../engine/GameLogic';
import { playerDictionary } from '../engine/Dictionary';
import { AutoSolver } from '../engine/AutoSolver';
import { colors } from '../theme';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

// Fixed overlay spacing — every gap between sections is the same.
const SECTION_GAP = 70;
const TITLE_BLOCK_H = 50;   // "Puzzle Solved!" + badge row
const STATS_BLOCK_H = 120;  // 4 stat rows
const BUTTON_BLOCK_H = 40;  // button height

interface GameScreenProps {
  mode: GameMode;
  puzzleType?: PuzzleType;
  difficulty?: Difficulty;
  onGameComplete: (result: GameResult) => void;
  onBack: () => void;
}

// ---------- stat helpers ----------

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatFrequency(freq: number): string {
  if (freq >= 1e-3) return 'Very common';
  if (freq >= 1e-4) return 'Common';
  if (freq >= 1e-5) return 'Uncommon';
  return 'Rare';
}

function formatSolveRate(successRate: number): string {
  return `${(successRate * 100).toFixed(1)}%`;
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statRowLabel}>{label}</Text>
      <Text style={styles.statRowValue}>{value}</Text>
    </View>
  );
}

// ---------- component ----------

export function GameScreen({
  mode,
  puzzleType = 'open',
  difficulty = 'easy',
  onGameComplete,
  onBack,
}: GameScreenProps) {
  const insets = useSafeAreaInsets();

  // Derive the completion layout from screen geometry.
  const completionLayout = useMemo(() => {
    const containerH = SCREEN_HEIGHT - insets.top;
    // Keyboard: paddingTop(8) + board(3*44 + 2*6 = 144) + paddingBottom(44 + max(bottom,8))
    const kbH = 8 + 144 + 44 + Math.max(insets.bottom, 8);
    const puzzleViewH = containerH - kbH;

    const fixedH = SECTION_GAP * 5 + TITLE_BLOCK_H + STATS_BLOCK_H + BUTTON_BLOCK_H;
    const puzzleSlotH = Math.max(100, containerH - fixedH);

    const scale = Math.min(0.85, puzzleSlotH / puzzleViewH);
    const slotCenter = SECTION_GAP + TITLE_BLOCK_H + SECTION_GAP + puzzleSlotH / 2;
    const translateY = slotCenter - puzzleViewH / 2;

    return {
      scale,
      translateY,
      puzzleSlotH,
      statsTableWidth: Math.round(SCREEN_WIDTH * scale),
    };
  }, [insets.top, insets.bottom]);

  const [puzzleMeta] = useState<GeneratedPuzzle | null>(() => {
    if (mode === 'puzzle') {
      return puzzleGenerator.generatePuzzle(puzzleType, difficulty);
    }
    return null;
  });
  const [grid, setGrid] = useState<GridType>(() => {
    if (puzzleMeta) {
      return parseGrid(puzzleMeta.puzzle);
    }
    return createMockGrid(mode, 0, 0);
  });
  const gridRef = useRef<GridHandle>(null);
  const autoSolverRef = useRef<AutoSolver | null>(null);
  const startTime = useRef(Date.now());
  const [hintLevel, setHintLevel] = useState<HintLevel>('count');
  const [solveMode, setSolveMode] = useState<SolveMode>('off');
  const [solveResult, setSolveResult] = useState<SolveFromHereResult | null>(null);
  const [headerBarHeight, setHeaderBarHeight] = useState(56);

  // ---- completion state & animation ----
  const [completedResult, setCompletedResult] = useState<GameResult | null>(null);

  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const kbTranslateY = useRef(new Animated.Value(0)).current;
  const puzzleScaleAnim = useRef(new Animated.Value(1)).current;
  const puzzleTranslateYAnim = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleScale = useRef(new Animated.Value(0.3)).current;
  const statsOpacity = useRef(new Animated.Value(0)).current;
  const statsTranslateY = useRef(new Animated.Value(30)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    return () => autoSolverRef.current?.stop();
  }, []);

  const cycleHintLevel = () => {
    setHintLevel(prev => (prev === 'off' ? 'count' : prev === 'count' ? 'example' : 'off'));
  };

  const toggleSolveMode = () => {
    if (solveMode === 'off') {
      const result = solveFromHere(grid, 1000);
      setSolveResult(result);
      setSolveMode('solve');
    } else {
      setSolveResult(null);
      setSolveMode('off');
    }
  };

  const handleAutoSolve = () => {
    autoSolverRef.current?.stop();
    const solver = new AutoSolver((letter) => {
      gridRef.current?.injectKey(letter);
    });
    autoSolverRef.current = solver;
    solver.start(grid);
  };

  const handleGridChange = (newGrid: GridType) => {
    setGrid(newGrid);
  };

  const isPuzzleComplete = useCallback((g: GridType): boolean => {
    for (let row = 0; row < g.rows; row++) {
      const hasAccessible = g.cells[row].some(c => c.accessible);
      if (!hasAccessible) continue;
      const allCorrect = g.cells[row].every(
        c => !c.accessible || c.validation === 'correct',
      );
      if (!allCorrect) return false;
    }
    return true;
  }, []);

  const computeVictoryStats = useCallback((completedGrid: GridType): GameResult => {
    const elapsed = Math.round((Date.now() - startTime.current) / 1000);
    const uniqueLetters = new Set<string>();
    const playerWords: string[] = [];

    for (let row = 0; row < completedGrid.rows; row++) {
      const hasAccessible = completedGrid.cells[row].some(c => c.accessible);
      if (!hasAccessible) continue;

      const allFixed = completedGrid.cells[row]
        .filter(c => c.accessible)
        .every(c => c.fixed);
      if (!allFixed) {
        playerWords.push(getWordFromRow(completedGrid, row));
      }

      for (let col = 0; col < completedGrid.cols; col++) {
        const cell = completedGrid.cells[row][col];
        if (cell.accessible && !cell.fixed && cell.letter) {
          uniqueLetters.add(cell.letter.toUpperCase());
        }
      }
    }

    let averageWordFrequency: number | undefined;
    const frequencies = playerWords
      .map(w => playerDictionary.getWordFrequency(w))
      .filter((f): f is number => f !== null);
    if (frequencies.length > 0) {
      averageWordFrequency = frequencies.reduce((a, b) => a + b, 0) / frequencies.length;
    }

    return {
      success: true,
      score: playerWords.length,
      finalGrid: cloneGrid(completedGrid),
      timeElapsed: elapsed,
      uniqueLetterCount: uniqueLetters.size,
      difficulty: puzzleMeta?.difficulty,
      successRate: puzzleMeta?.successRate,
      averageWordFrequency,
    };
  }, [puzzleMeta]);

  const startCompletionAnimation = useCallback((result: GameResult) => {
    setCompletedResult(result);
    setSolveResult(null);
    setSolveMode('off');

    const easeOut = Easing.out(Easing.cubic);
    const easeInOut = Easing.inOut(Easing.cubic);

    Animated.parallel([
      // Header slides up fully out of view (including shadow): 0–250 ms
      Animated.timing(headerTranslateY, {
        toValue: -(headerBarHeight * 2),
        duration: 250,
        easing: easeOut,
        useNativeDriver: true,
      }),

      // Keyboard slides down: 0–300 ms
      Animated.timing(kbTranslateY, {
        toValue: 300,
        duration: 300,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),

      // "SOLVED" title pops in: 0–300 ms
      Animated.timing(titleOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(titleScale, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: true,
      }),

      // Puzzle zooms out + rises: 150–550 ms
      Animated.sequence([
        Animated.delay(150),
        Animated.parallel([
          Animated.timing(puzzleScaleAnim, {
            toValue: completionLayout.scale,
            duration: 400,
            easing: easeInOut,
            useNativeDriver: true,
          }),
          Animated.timing(puzzleTranslateYAnim, {
            toValue: completionLayout.translateY,
            duration: 400,
            easing: easeInOut,
            useNativeDriver: true,
          }),
        ]),
      ]),

      // Stats slide up: 500–800 ms
      Animated.sequence([
        Animated.delay(500),
        Animated.parallel([
          Animated.timing(statsOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(statsTranslateY, {
            toValue: 0,
            duration: 300,
            easing: easeOut,
            useNativeDriver: true,
          }),
        ]),
      ]),

      // Button fades in: 750–1000 ms
      Animated.sequence([
        Animated.delay(750),
        Animated.timing(buttonOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [
    completionLayout,
    headerBarHeight,
    headerTranslateY, kbTranslateY,
    puzzleScaleAnim, puzzleTranslateYAnim,
    titleOpacity, titleScale,
    statsOpacity, statsTranslateY,
    buttonOpacity,
  ]);

  const handleRowValidated = (row: number, isValid: boolean) => {
    if (mode === 'action' && !isValid) {
      setTimeout(() => {
        onGameComplete({
          success: false,
          score: row - 1,
        });
      }, 500);
      return;
    }

    if (mode === 'puzzle' && isValid) {
      setTimeout(() => {
        setGrid(current => {
          if (isPuzzleComplete(current)) {
            startCompletionAnimation(computeVictoryStats(current));
          }
          return current;
        });
      }, 0);
    }
  };

  const isCompleted = completedResult != null;

  return (
    <View style={styles.container}>
      <Grid
        ref={gridRef}
        grid={grid}
        mode={mode}
        readOnly={isCompleted}
        onGridChange={handleGridChange}
        onRowValidated={handleRowValidated}
        hintLevel={isCompleted ? 'off' : hintLevel}
        solveOverlay={isCompleted ? null : solveResult}
        scrollContentTopInset={headerBarHeight}
        puzzleScale={puzzleScaleAnim}
        puzzleTranslateY={puzzleTranslateYAnim}
        keyboardTranslateY={kbTranslateY}
      />

      {/* Header bar */}
      <Animated.View
        style={[styles.headerBar, { transform: [{ translateY: headerTranslateY }] }]}
        pointerEvents={isCompleted ? 'none' : 'box-none'}
        onLayout={(e) => setHeaderBarHeight(e.nativeEvent.layout.height)}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerSide}>
            <TouchableOpacity style={styles.headerButton} onPress={onBack} hitSlop={8}>
              <Text style={styles.backArrow}>←</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.headerCenter}>
            <Text style={styles.modeText} numberOfLines={1}>
              {mode === 'action'
                ? 'Action Mode'
                : `Puzzle - ${puzzleType.charAt(0).toUpperCase() + puzzleType.slice(1)} (${difficulty})`}
            </Text>
          </View>

          <View style={[styles.headerSide, styles.headerSideEnd]}>
            <TouchableOpacity style={styles.headerButton} onPress={cycleHintLevel} hitSlop={8}>
              <Text style={[styles.hintLabel, hintLevel !== 'off' && styles.hintLabelActive]}>
                {hintLevel === 'off' ? 'OFF' : hintLevel === 'count' ? '#' : 'Ex'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton} onPress={toggleSolveMode} hitSlop={8}>
              <Text style={[styles.hintLabel, solveMode === 'solve' && styles.hintLabelActive]}>
                {solveMode === 'off' ? 'OFF' : 'SLV'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton} onPress={handleAutoSolve} hitSlop={8}>
              <Text style={styles.hintLabel}>END</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      {/* Results overlay — fixed-height layout, no flex guessing */}
      {isCompleted && (
        <View style={styles.resultsOverlay} pointerEvents="box-none">
          <View style={styles.sectionGap} />

          <Animated.View
            style={[styles.titleArea, { opacity: titleOpacity, transform: [{ scale: titleScale }] }]}
          >
            <Text style={styles.solvedTitle}>Puzzle Solved!</Text>
            <View style={styles.badgeRow}>
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>
                  {puzzleType.charAt(0).toUpperCase() + puzzleType.slice(1)}
                </Text>
              </View>
              {completedResult.difficulty && (
                <View style={styles.difficultyBadge}>
                  <Text style={styles.difficultyText}>
                    {completedResult.difficulty.charAt(0).toUpperCase() +
                      completedResult.difficulty.slice(1)}
                  </Text>
                </View>
              )}
            </View>
          </Animated.View>

          <View style={styles.sectionGap} />
          {/* Puzzle shows through this transparent slot */}
          <View style={{ height: completionLayout.puzzleSlotH }} />
          <View style={styles.sectionGap} />

          <Animated.View
            style={[
              styles.statsArea,
              { opacity: statsOpacity, transform: [{ translateY: statsTranslateY }] },
            ]}
          >
            <View style={[styles.statsTable, { width: completionLayout.statsTableWidth }]}>
              {completedResult.timeElapsed != null && (
                <StatRow label="Time" value={formatTime(completedResult.timeElapsed)} />
              )}
              {completedResult.uniqueLetterCount != null && (
                <StatRow label="Unique Letters" value={String(completedResult.uniqueLetterCount)} />
              )}
              {completedResult.successRate != null && (
                <StatRow label="Solve Rate" value={formatSolveRate(completedResult.successRate)} />
              )}
              {completedResult.averageWordFrequency != null && (
                <StatRow label="Word Rarity" value={formatFrequency(completedResult.averageWordFrequency)} />
              )}
            </View>
          </Animated.View>

          <View style={styles.sectionGap} />

          <Animated.View style={[styles.buttonArea, { opacity: buttonOpacity }]}>
            <TouchableOpacity
              style={styles.menuButton}
              onPress={() => onGameComplete(completedResult)}
            >
              <Text style={styles.menuButtonText}>Back to Menu</Text>
            </TouchableOpacity>
          </Animated.View>

          <View style={styles.sectionGap} />
        </View>
      )}
    </View>
  );
}

const barShadow = {
  shadowColor: colors.shadow,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.12,
  shadowRadius: 3,
  elevation: 4,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#4A4A4A',
    paddingHorizontal: 8,
    paddingVertical: 6,
    ...barShadow,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  headerSide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  headerSideEnd: {
    justifyContent: 'flex-end',
    gap: 4,
  },
  headerCenter: {
    flex: 2,
    alignItems: 'center',
    minWidth: 0,
    paddingHorizontal: 4,
  },
  headerButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 24,
    color: colors.accent,
    fontWeight: '600',
  },
  hintLabel: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  hintLabelActive: {
    color: colors.accent,
  },
  modeText: {
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '600',
    textAlign: 'center',
  },

  // ---- results overlay ----
  resultsOverlay: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 16,
    zIndex: 20,
  },
  sectionGap: {
    height: SECTION_GAP,
  },
  titleArea: {
    alignItems: 'center',
  },
  solvedTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  typeBadge: {
    backgroundColor: colors.textMuted,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 14,
  },
  typeBadgeText: {
    color: colors.textOnAccent,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  difficultyBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 14,
  },
  difficultyText: {
    color: colors.textOnAccent,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  statsArea: {
    alignItems: 'center',
  },
  statsTable: {
    alignSelf: 'center',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingVertical: 5,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  statRowLabel: {
    fontSize: 15,
    color: colors.textMuted,
    fontWeight: '500',
  },
  statRowValue: {
    fontSize: 15,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  buttonArea: {
    alignItems: 'center',
  },
  menuButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  menuButtonText: {
    color: colors.textOnAccent,
    fontSize: 18,
    fontWeight: '600',
  },
});
