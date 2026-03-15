import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, LayoutAnimation, Platform, UIManager } from 'react-native';
import { GameMode, PuzzleType, Difficulty } from '../engine/types';
import { colors } from '../theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface StartScreenProps {
  onSelectMode: (mode: GameMode, puzzleType?: PuzzleType, difficulty?: Difficulty) => void;
}

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

export function StartScreen({ onSelectMode }: StartScreenProps) {
  const [showPuzzleTypes, setShowPuzzleTypes] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('easy');

  const handlePuzzlePress = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowPuzzleTypes(!showPuzzleTypes);
  };

  const handleDifficultyPress = (d: Difficulty) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedDifficulty(d);
  };

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <Text style={styles.logo}>WordTravel</Text>
        <Text style={styles.tagline}>Journey through words</Text>
      </View>

      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          style={styles.button}
          onPress={handlePuzzlePress}
        >
          <Text style={styles.buttonText}>Puzzle</Text>
        </TouchableOpacity>

        {showPuzzleTypes && (
          <View style={styles.subButtons}>
            <View style={styles.difficultyRow}>
              {DIFFICULTIES.map(d => (
                <TouchableOpacity
                  key={d}
                  style={[
                    styles.difficultyChip,
                    selectedDifficulty === d && styles.difficultyChipSelected,
                  ]}
                  onPress={() => handleDifficultyPress(d)}
                >
                  <Text
                    style={[
                      styles.difficultyChipText,
                      selectedDifficulty === d && styles.difficultyChipTextSelected,
                    ]}
                  >
                    {d.charAt(0).toUpperCase() + d.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.subButton}
              onPress={() => onSelectMode('puzzle', 'open', selectedDifficulty)}
            >
              <Text style={styles.subButtonText}>Open</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.subButton}
              onPress={() => onSelectMode('puzzle', 'bridge', selectedDifficulty)}
            >
              <Text style={styles.subButtonText}>Bridge</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.subButton}
              onPress={() => onSelectMode('puzzle', 'semi', selectedDifficulty)}
            >
              <Text style={styles.subButtonText}>Semi</Text>
            </TouchableOpacity>
          </View>
        )}

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
  subButtons: {
    marginBottom: 16,
    gap: 8,
  },
  difficultyRow: {
    flexDirection: 'row',
    gap: 8,
  },
  difficultyChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.textMuted,
    backgroundColor: colors.surface,
  },
  difficultyChipSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  difficultyChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  difficultyChipTextSelected: {
    color: colors.textOnAccent,
  },
  subButton: {
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  subButtonText: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '600',
  },
});

