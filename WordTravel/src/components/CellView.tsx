import React from 'react';
import { View, TextInput, Text, StyleSheet, ViewStyle } from 'react-native';
import { Cell, isBidirectionalSoftForbidden } from '../engine/types';
import { RuleFulfillment } from '../engine/GameLogic';
import { colors, layout } from '../theme';
import { BIDIRECTIONAL_MODIFIER_OFFSET_PX } from '../tileTheme';
import { ModifierOverlay } from './ModifierOverlay';

interface CellViewProps {
  cell: Cell;
  cellSize: number;
  tileSize: number;
  ghostLetter?: string;
  active?: boolean;
  modifierFulfillment?: RuleFulfillment;
  modifierRotation?: 0 | 180;
}

export function CellView({ cell, cellSize, tileSize, ghostLetter, active, modifierFulfillment, modifierRotation }: CellViewProps) {
  if (!cell.accessible) {
    return <View style={{ width: cellSize, height: cellSize }} />;
  }

  const ruleTile = cell.ruleTile;
  const showModifier =
    ruleTile?.type === 'hardMatch' ||
    ruleTile?.type === 'softMatch' ||
    ruleTile?.type === 'forbiddenMatch';

  return (
    <View style={[styles.cellOuter, { width: cellSize, height: cellSize }]}>
      <View style={[
        styles.tile,
        { width: tileSize, height: tileSize, borderRadius: layout.tileCornerRadius },
        cell.fixed && { backgroundColor: colors.background },
        active && { borderColor: colors.tileBorderActive },
      ]}>
        {showModifier && ruleTile && modifierFulfillment != null && (
          (ruleTile.type === 'softMatch' || ruleTile.type === 'forbiddenMatch') &&
          isBidirectionalSoftForbidden(ruleTile) ? (
            <View style={styles.modifierStack} pointerEvents="none">
              <View style={bidirectionalDownLayerStyle(BIDIRECTIONAL_MODIFIER_OFFSET_PX)}>
                <ModifierOverlay
                  ruleType={ruleTile.type}
                  fulfillment={modifierFulfillment}
                  rotation={0}
                />
              </View>
              <View style={bidirectionalUpLayerStyle(BIDIRECTIONAL_MODIFIER_OFFSET_PX)}>
                <ModifierOverlay
                  ruleType={ruleTile.type}
                  fulfillment={modifierFulfillment}
                  rotation={180}
                />
              </View>
            </View>
          ) : (
            <ModifierOverlay
              ruleType={ruleTile.type}
              fulfillment={modifierFulfillment}
              rotation={modifierRotation ?? 0}
            />
          )
        )}
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
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    overflow: 'hidden',
  },
  modifierStack: {
    ...StyleSheet.absoluteFillObject,
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
});

function bidirectionalDownLayerStyle(offsetPx: number): ViewStyle {
  if (offsetPx === 0) return styles.modifierStack;
  return {
    ...StyleSheet.absoluteFillObject,
    transform: [{ translateY: offsetPx }],
  };
}

function bidirectionalUpLayerStyle(offsetPx: number): ViewStyle {
  if (offsetPx === 0) return styles.modifierStack;
  return {
    ...StyleSheet.absoluteFillObject,
    transform: [{ translateY: -offsetPx }],
  };
}

