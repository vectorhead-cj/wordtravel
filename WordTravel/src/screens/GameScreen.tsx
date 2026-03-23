import React, { useState, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { GameMode, GameResult, PuzzleType, Difficulty, Grid as GridType, HintLevel, SolveMode } from '../engine/types';
import { Grid } from '../components/Grid';
import { createMockGrid } from '../engine/mockData';
import { puzzleGenerator, GeneratedPuzzle } from '../engine/PuzzleGenerator';
import { parseGrid } from '../engine/PuzzleNotation';
import { solveFromHere, SolveFromHereResult } from '../engine/DifficultySimulator';
import { getWordFromRow } from '../engine/GameLogic';
import { playerDictionary } from '../engine/Dictionary';
import { colors } from '../theme';

interface GameScreenProps {
  mode: GameMode;
  puzzleType?: PuzzleType;
  difficulty?: Difficulty;
  onGameComplete: (result: GameResult) => void;
  onBack: () => void;
}

export function GameScreen({ 
  mode, 
  puzzleType = 'open',
  difficulty = 'easy',
  onGameComplete, 
  onBack,
}: GameScreenProps) {
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
  const startTime = useRef(Date.now());
  const [hintLevel, setHintLevel] = useState<HintLevel>('count');
  const [solveMode, setSolveMode] = useState<SolveMode>('off');
  const [solveResult, setSolveResult] = useState<SolveFromHereResult | null>(null);
  const [headerBarHeight, setHeaderBarHeight] = useState(56);

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
      timeElapsed: elapsed,
      uniqueLetterCount: uniqueLetters.size,
      difficulty: puzzleMeta?.difficulty,
      successRate: puzzleMeta?.successRate,
      averageWordFrequency,
    };
  }, [puzzleMeta]);

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
      // Use a setTimeout so the validated grid state has flushed before we check
      setTimeout(() => {
        setGrid(current => {
          if (isPuzzleComplete(current)) {
            onGameComplete(computeVictoryStats(current));
          }
          return current;
        });
      }, 0);
    }
  };

  return (
    <View style={styles.container}>
      <Grid
        grid={grid}
        mode={mode}
        onGridChange={handleGridChange}
        onRowValidated={handleRowValidated}
        hintLevel={hintLevel}
        solveOverlay={solveResult}
        scrollContentTopInset={headerBarHeight}
      />

      <View
        style={styles.headerBar}
        pointerEvents="box-none"
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
                : `Puzzle - ${puzzleType.charAt(0).toUpperCase() + puzzleType.slice(1)}`}
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
          </View>
        </View>
      </View>
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
});

