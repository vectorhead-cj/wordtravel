import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { GameMode, GameResult, Grid as GridType } from '../engine/types';
import { Grid } from '../components/Grid';
import { createMockGrid } from '../engine/mockData';

interface GameScreenProps {
  mode: GameMode;
  onGameComplete: (result: GameResult) => void;
  onBack: () => void;
}

export function GameScreen({ mode, onGameComplete: _onGameComplete, onBack }: GameScreenProps) {
  const [grid, setGrid] = useState<GridType>(() => createMockGrid(mode));

  const handleGridChange = (newGrid: GridType) => {
    setGrid(newGrid);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.modeText}>{mode} mode</Text>
      </View>

      <Grid grid={grid} onGridChange={handleGridChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
    marginLeft: 4,
  },
  backArrow: {
    fontSize: 28,
    color: '#007AFF',
  },
  modeText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
    fontWeight: '500',
  },
});

