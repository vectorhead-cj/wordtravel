import React from 'react';
import { View, TextInput, Text, StyleSheet } from 'react-native';
import { Cell } from '../engine/types';
import { colors, layout } from '../theme';

interface CellViewProps {
  cell: Cell;
  cellSize: number;
  tileSize: number;
  badgeCount: number | null;
  badgeExamples?: string[];
  ghostLetter?: string;
}

export function CellView({ cell, cellSize, tileSize, badgeCount, badgeExamples, ghostLetter }: CellViewProps) {
  if (!cell.accessible) {
    if (badgeCount !== null) {
      return (
        <View style={[styles.badgeContainer, { width: cellSize, height: cellSize }]}>
          <Text style={styles.wordCountBadge}>{badgeCount}</Text>
          {badgeExamples && badgeExamples.length > 0 && (
            <View style={styles.wordExamplesContainer}>
              {badgeExamples.map((word, i) => (
                <Text key={i} style={styles.wordExamplesBadge} numberOfLines={1}>
                  {word}
                </Text>
              ))}
            </View>
          )}
        </View>
      );
    }
    return <View style={{ width: cellSize, height: cellSize }} />;
  }

  const ruleTile = cell.ruleTile;
  const showFilledCircle = ruleTile?.type === 'hardMatch' && ruleTile.constraint.position === 'top';
  const showHollowCircle = ruleTile?.type === 'softMatch';
  const showForbidden = ruleTile?.type === 'forbiddenMatch';

  return (
    <View style={[styles.cellOuter, { width: cellSize, height: cellSize }]}>
      <View style={[
        styles.tile,
        { width: tileSize, height: tileSize, borderRadius: layout.tileCornerRadius },
        cell.fixed && { backgroundColor: colors.background },
      ]}>
        <View style={styles.cellContent}>
          {cell.letter ? (
            <View style={styles.letterContainer}>
              <TextInput style={styles.letter} value={cell.letter} editable={false} />
            </View>
          ) : ghostLetter ? (
            <View style={styles.letterContainer}>
              <Text style={styles.ghostLetter}>{ghostLetter}</Text>
            </View>
          ) : null}
          {showFilledCircle && <Text style={styles.ruleIndicator}>●</Text>}
          {showHollowCircle && <Text style={styles.ruleIndicator}>○</Text>}
          {showForbidden && <Text style={styles.ruleIndicator}>−</Text>}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badgeContainer: {
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingLeft: 4,
  },
  wordCountBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.ruleIndicatorNeutral,
  },
  wordExamplesContainer: {
    marginTop: 2,
  },
  wordExamplesBadge: {
    fontSize: 9,
    color: colors.textMuted,
    maxWidth: '100%',
  },
  cellOuter: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  tile: {
    backgroundColor: colors.tile,
    borderWidth: layout.tileBorderWidth,
    borderColor: colors.tileStroke,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cellContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  letterContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  letter: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.letterDefault,
    textAlign: 'center',
  },
  ghostLetter: {
    fontSize: 28,
    fontWeight: '300',
    color: colors.textMuted,
    textAlign: 'center',
    opacity: 0.5,
  },
  ruleIndicator: {
    position: 'absolute',
    bottom: 2,
    fontSize: 8,
    fontWeight: 'bold',
    color: colors.ruleIndicatorNeutral,
  },
});

