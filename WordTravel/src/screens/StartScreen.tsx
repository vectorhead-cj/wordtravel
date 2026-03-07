import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { GameMode } from '../engine/types';
import { colors } from '../theme';

interface StartScreenProps {
  onSelectMode: (mode: GameMode) => void;
}

export function StartScreen({ onSelectMode }: StartScreenProps) {
  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <Text style={styles.logo}>WordTravel</Text>
        <Text style={styles.tagline}>Journey through words</Text>
      </View>

      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => onSelectMode('puzzle')}
        >
          <Text style={styles.buttonText}>Puzzle</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={() => onSelectMode('action')}
        >
          <Text style={styles.buttonText}>Action</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  logo: {
    fontSize: 48,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  tagline: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 8,
  },
  buttonsContainer: {
    width: '100%',
    maxWidth: 300,
  },
  button: {
    backgroundColor: colors.accent,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    color: colors.textOnAccent,
    fontSize: 18,
    fontWeight: '600',
  },
});

