import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import Svg, { Polygon, Rect, Path } from 'react-native-svg';
import { RuleTile } from '../engine/types';

interface ModifierOverlayProps {
  ruleType: RuleTile['type'];
  color: string;
  rotation: 0 | 180;
}

function Shape({ ruleType, color }: { ruleType: RuleTile['type']; color: string }) {
  switch (ruleType) {
    case 'hardMatch':
      return <Polygon points="50,75 0,100 100,100" fill={color} />;
    case 'softMatch':
      return <Rect x={0} y={75} width={100} height={25} fill={color} />;
    case 'forbiddenMatch':
      return <Path d="M 0,75 L 0,100 L 100,100 L 100,75 L 50,100 Z" fill={color} />;
  }
}

export function ModifierOverlay({ ruleType, color, rotation }: ModifierOverlayProps) {
  const overlayStyle: ViewStyle = rotation === 180
    ? { ...styles.overlay, transform: [{ rotate: '180deg' }] }
    : styles.overlay;

  return (
    <Svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      width="100%"
      height="100%"
      style={overlayStyle}
    >
      <Shape ruleType={ruleType} color={color} />
    </Svg>
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
