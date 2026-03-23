import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { GameResult } from '../engine/types';
import { colors } from '../theme';

interface ResultScreenProps {
  result: GameResult;
  onBackToMenu: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatFrequency(freq: number): string {
  if (freq >= 1e-3) return 'Very common';
  if (freq >= 1e-4) return 'Common';
  if (freq >= 1e-5) return 'Uncommon';
  return 'Rare';
}

function formatDifficulty(successRate: number): string {
  return `${(successRate * 100).toFixed(1)}%`;
}

interface StatCardProps {
  label: string;
  value: string;
  detail?: string;
}

function StatCard({ label, value, detail }: StatCardProps) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {detail ? <Text style={styles.statDetail}>{detail}</Text> : null}
    </View>
  );
}

export function ResultScreen({ result, onBackToMenu }: ResultScreenProps) {
  const isVictory = result.success;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {isVictory ? 'Solved!' : 'Game Over'}
      </Text>

      {isVictory && result.difficulty && (
        <View style={styles.difficultyBadge}>
          <Text style={styles.difficultyText}>
            {result.difficulty.charAt(0).toUpperCase() + result.difficulty.slice(1)}
          </Text>
        </View>
      )}

      <View style={styles.statsGrid}>
        {result.timeElapsed != null && (
          <StatCard label="Time" value={formatTime(result.timeElapsed)} />
        )}
        {result.uniqueLetterCount != null && (
          <StatCard label="Unique Letters" value={String(result.uniqueLetterCount)} />
        )}
        {result.successRate != null && (
          <StatCard
            label="Solve Rate"
            value={formatDifficulty(result.successRate)}
            detail="of random attempts"
          />
        )}
        {result.averageWordFrequency != null && (
          <StatCard
            label="Word Rarity"
            value={formatFrequency(result.averageWordFrequency)}
            detail={result.averageWordFrequency.toExponential(1)}
          />
        )}
      </View>

      {!isVictory && (
        <Text style={styles.scoreLine}>Score: {result.score}</Text>
      )}

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
  difficultyBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 32,
  },
  difficultyText: {
    color: colors.textOnAccent,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 40,
    maxWidth: 320,
  },
  statCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    minWidth: 140,
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  statDetail: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
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

