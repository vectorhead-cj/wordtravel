import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { GameMode, GameResult, PuzzleType, Difficulty, Grid as GridType, HintLevel, SolveMode } from '../engine/types';
import { Grid } from '../components/Grid';
import { createMockGrid } from '../engine/mockData';
import { puzzleGenerator } from '../engine/PuzzleGenerator';
import { parseGrid } from '../engine/PuzzleNotation';
import { solveFromHere, SolveFromHereResult } from '../engine/DifficultySimulator';
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
  const [grid, setGrid] = useState<GridType>(() => {
    if (mode === 'puzzle') {
      const { puzzle } = puzzleGenerator.generatePuzzle(puzzleType, difficulty);
      return parseGrid(puzzle);
    }
    return createMockGrid(mode, 0, 0);
  });
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

  const handleRowValidated = (row: number, isValid: boolean) => {
    if (mode === 'action' && !isValid) {
      setTimeout(() => {
        onGameComplete({
          success: false,
          score: row - 1,
        });
      }, 500);
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

