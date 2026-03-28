import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { GameResult } from '../engine/types';
import { colors } from '../theme';

interface ResultScreenProps {
  result: GameResult;
  onBackToMenu: () => void;
}

export function ResultScreen({ result, onBackToMenu }: ResultScreenProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Game Over</Text>
      <Text style={styles.scoreLine}>Score: {result.score}</Text>

      <TouchableOpacity style={styles.button} onPress={onBackToMenu}>
        <Text style={styles.buttonText}>Back to Menu</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 24,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  scoreLine: {
    fontSize: 20,
    color: colors.textSecondary,
    marginBottom: 40,
  },
  button: {
    backgroundColor: colors.accent,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  buttonText: {
    color: colors.textOnAccent,
    fontSize: 18,
    fontWeight: '600',
  },
});
