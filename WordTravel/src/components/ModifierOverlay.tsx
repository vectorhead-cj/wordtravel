import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { RuleTile } from '../engine/types';
import { RuleFulfillment } from '../engine/GameLogic';
import { resolveModifierColor, resolveModifierSource } from '../tileTheme';

interface ModifierOverlayProps {
  ruleType: RuleTile['type'];
  fulfillment: RuleFulfillment;
  rotation: 0 | 180;
}

export function ModifierOverlay({ ruleType, fulfillment, rotation }: ModifierOverlayProps) {
  const SvgIcon = resolveModifierSource(ruleType);
  const color = resolveModifierColor(ruleType, fulfillment);

  const wrapperStyle: ViewStyle = rotation === 180
    ? { ...styles.overlay, transform: [{ rotate: '180deg' }] }
    : styles.overlay;

  return (
    <View style={wrapperStyle} pointerEvents="none">
      <SvgIcon
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        color={color}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
