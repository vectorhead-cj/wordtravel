import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { GameResult } from '../engine/types';

interface ResultScreenProps {
  result: GameResult;
  onBackToMenu: () => void;
}

export function ResultScreen({ result, onBackToMenu }: ResultScreenProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {result.success ? 'Success!' : 'Game Over'}
      </Text>

      <View style={styles.statsContainer}>
        <Text style={styles.stat}>Score: {result.score}</Text>
        {result.timeElapsed && (
          <Text style={styles.stat}>Time: {result.timeElapsed}s</Text>
        )}
      </View>

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
    backgroundColor: '#fff',
    padding: 20,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 40,
  },
  statsContainer: {
    marginBottom: 60,
  },
  stat: {
    fontSize: 20,
    color: '#666',
    marginBottom: 12,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});

