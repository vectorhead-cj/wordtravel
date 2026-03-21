import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GameMode, GameResult, PuzzleType, Difficulty, Grid as GridType, HintLevel, SolveMode } from '../engine/types';
import { Grid } from '../components/Grid';
import { createMockGrid } from '../engine/mockData';
import { puzzleGenerator } from '../engine/PuzzleGenerator';
import { parseGrid, addPadding } from '../engine/PuzzleNotation';
import { solveFromHere, SolveFromHereResult } from '../engine/DifficultySimulator';
import { colors } from '../theme';

interface GameScreenProps {
  mode: GameMode;
  puzzleType?: PuzzleType;
  difficulty?: Difficulty;
  onGameComplete: (result: GameResult) => void;
  onBack: () => void;
  paddingRowsTop?: number;
  paddingRowsBottom?: number;
}

export function GameScreen({ 
  mode, 
  puzzleType = 'open',
  difficulty = 'easy',
  onGameComplete, 
  onBack,
  paddingRowsTop = 3,
  paddingRowsBottom = 10,
}: GameScreenProps) {
  const [grid, setGrid] = useState<GridType>(() => {
    if (mode === 'puzzle') {
      const { puzzle } = puzzleGenerator.generatePuzzle(puzzleType, difficulty);
      return addPadding(parseGrid(puzzle), paddingRowsTop, paddingRowsBottom);
    }
    return createMockGrid(mode, paddingRowsTop, paddingRowsBottom);
  });
  const [hintLevel, setHintLevel] = useState<HintLevel>('count');
  const [solveMode, setSolveMode] = useState<SolveMode>('off');
  const [solveResult, setSolveResult] = useState<SolveFromHereResult | null>(null);

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
      />
      
      <SafeAreaView style={styles.floatingHeader} pointerEvents="box-none">
        <View style={styles.headerRow}>
          <View style={styles.leftSection}>
            <TouchableOpacity style={styles.backButton} onPress={onBack}>
              <Text style={styles.backArrow}>←</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.centerSection}>
            <View style={styles.modePill}>
              <Text style={styles.modeText} numberOfLines={1}>
                {mode === 'action' ? 'Action Mode' : `Puzzle - ${puzzleType.charAt(0).toUpperCase() + puzzleType.slice(1)}`}
              </Text>
            </View>
          </View>
          
          <View style={styles.rightSection}>
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={cycleHintLevel}
            >
              <Text style={[styles.hintLabel, hintLevel !== 'off' && styles.hintLabelActive]}>
                {hintLevel === 'off' ? 'OFF' : hintLevel === 'count' ? '#' : 'Ex'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={toggleSolveMode}
            >
              <Text style={[styles.hintLabel, solveMode === 'solve' && styles.hintLabelActive]}>
                {solveMode === 'off' ? 'OFF' : 'SLV'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const floatingShadow = {
  shadowColor: colors.shadow,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.25,
  shadowRadius: 4,
  elevation: 5,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  floatingHeader: {
    position: 'absolute',
    top: 10,
    left: 16,
    right: 16,
    paddingTop: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leftSection: {
    position: 'absolute',
    left: 0,
  },
  centerSection: {
    flexShrink: 0,
  },
  rightSection: {
    position: 'absolute',
    right: 0,
    flexDirection: 'row',
    gap: 8,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...floatingShadow,
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
  modePill: {
    height: 44,
    paddingHorizontal: 20,
    justifyContent: 'center',
    borderRadius: 100,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    ...floatingShadow,
  },
  modeText: {
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '600',
    flexShrink: 0,
  },
});

