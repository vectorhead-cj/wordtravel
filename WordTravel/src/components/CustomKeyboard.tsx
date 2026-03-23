import React from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';

const ROW1 = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'];
const ROW2 = ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'];
const ROW3 = ['Z', 'X', 'C', 'V', 'B', 'N', 'M'];

const H_PADDING = 8;
const GAP = 5;
const KEY_HEIGHT = 44;
const ROW_GAP = 6;

interface CustomKeyboardProps {
  onKey: (letter: string) => void;
  onBackspace: () => void;
}

export function CustomKeyboard({ onKey, onBackspace }: CustomKeyboardProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const available = width - H_PADDING * 2;
  const keyWidth = (available - GAP * (ROW1.length - 1)) / ROW1.length;
  const step = keyWidth + GAP;

  const row2Offset = step * 0.5;
  const row3Offset = step * 1.5;
  // fills from after M to the right edge — exact 1.5-key width
  const backspaceWidth = available - row3Offset - ROW3.length * step + GAP;

  const totalRows = 3;
  const boardHeight = totalRows * KEY_HEIGHT + (totalRows - 1) * ROW_GAP;

  const renderKey = (letter: string, x: number, y: number, w: number, isBack = false) => (
    <Pressable
      key={letter}
      style={({ pressed }) => [
        styles.key,
        { width: w, height: KEY_HEIGHT, left: x, top: y },
        pressed && styles.keyPressed,
      ]}
      onPress={() => (isBack ? onBackspace() : onKey(letter))}
    >
      <Text style={isBack ? styles.backspaceLabel : styles.keyLabel}>{letter}</Text>
    </Pressable>
  );

  const rows = [ROW1, ROW2, ROW3];
  const offsets = [0, row2Offset, row3Offset];

  return (
    <View
      style={[
        styles.wrap,
        { paddingBottom: KEY_HEIGHT + Math.max(insets.bottom, 8) },
      ]}
    >
      <View style={[styles.board, { width: available, height: boardHeight }]}>
        {rows.map((row, ri) => {
          const y = ri * (KEY_HEIGHT + ROW_GAP);
          return row.map((letter, ci) =>
            renderKey(letter, offsets[ri] + ci * step, y, keyWidth),
          );
        })}
        {renderKey(
          '⌫',
          row3Offset + ROW3.length * step,
          2 * (KEY_HEIGHT + ROW_GAP),
          backspaceWidth,
          true,
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#4A4A4A',
    paddingTop: 8,
    paddingHorizontal: H_PADDING,
    alignItems: 'center',
  },
  board: {
    position: 'relative',
  },
  key: {
    position: 'absolute',
    borderRadius: 8,
    backgroundColor: colors.tile,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#CCCCCC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyPressed: {
    opacity: 0.75,
    backgroundColor: '#E0D8CC',
  },
  keyLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.letterDefault,
  },
  backspaceLabel: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.accent,
  },
});
