import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GameMode, GameResult, Grid as GridType } from '../engine/types';
import { Grid } from '../components/Grid';
import { createMockGrid } from '../engine/mockData';
import { puzzleGenerator } from '../engine/PuzzleGenerator';
import { dictionary } from '../engine/Dictionary';

interface GameScreenProps {
  mode: GameMode;
  onGameComplete: (result: GameResult) => void;
  onBack: () => void;
  paddingRowsTop?: number;
  paddingRowsBottom?: number;
}

export function GameScreen({ 
  mode, 
  onGameComplete, 
  onBack,
  paddingRowsTop = 3,
  paddingRowsBottom = 10,
}: GameScreenProps) {
  const [grid, setGrid] = useState<GridType>(() => {
    if (mode === 'puzzle') {
      const config = puzzleGenerator.generatePuzzleConfig(paddingRowsTop, paddingRowsBottom);
      return puzzleGenerator.createGridFromConfig(config);
    }
    return createMockGrid(mode, paddingRowsTop, paddingRowsBottom);
  });

  useEffect(() => {
    dictionary.initialize();
  }, []);

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
                {mode === 'puzzle' ? 'Puzzle Mode' : 'Action Mode'}
              </Text>
            </View>
          </View>
          
          <View style={styles.rightSection} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const floatingShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.25,
  shadowRadius: 4,
  elevation: 5,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...floatingShadow,
  },
  backArrow: {
    fontSize: 24,
    color: '#007AFF',
    fontWeight: '600',
  },
  modePill: {
    height: 44,
    paddingHorizontal: 20,
    justifyContent: 'center',
    borderRadius: 100,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    ...floatingShadow,
  },
  modeText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
    flexShrink: 0,
  },
});

