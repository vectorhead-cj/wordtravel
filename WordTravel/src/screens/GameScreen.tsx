import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { GameMode, GameResult } from '../engine/types';

interface GameScreenProps {
  mode: GameMode;
  onGameComplete: (result: GameResult) => void;
  onBack: () => void;
}

export function GameScreen({ mode, onGameComplete, onBack }: GameScreenProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Text style={styles.placeholder}>
          Game Screen - {mode} mode
        </Text>
        <Text style={styles.subtext}>
          (Grid and game logic will go here)
        </Text>
      </View>
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
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: {
    fontSize: 24,
    color: '#333',
  },
  subtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
});

