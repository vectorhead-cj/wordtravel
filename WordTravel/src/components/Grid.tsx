import React, { useRef, useEffect, useMemo } from 'react';
import {
  View,
  TextInput,
  ScrollView,
  StyleSheet,
  Dimensions,
  Pressable,
} from 'react-native';
import { Grid as GridType, GameMode } from '../engine/types';
import { countValidNextWords } from '../engine/GameLogic';
import { colors, layout } from '../theme';
import { CellView } from './CellView';
import { ErrorToast } from './ErrorToast';
import { useGridInput } from '../hooks/useGridInput';

interface GridProps {
  grid: GridType;
  mode: GameMode;
  onGridChange: (grid: GridType) => void;
  onRowValidated: (row: number, isValid: boolean) => void;
  showRuleHelpers: boolean;
}

export function Grid({ grid, mode, onGridChange, onRowValidated, showRuleHelpers: _showRuleHelpers }: GridProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  const textInputRef = useRef<TextInput>(null);

  const { currentPosition, errorMessage, handleKeyPress, handleBackspace } = useGridInput({
    grid,
    mode,
    onGridChange,
    onRowValidated,
  });

  const validNextWordCounts = useMemo(() => {
    return grid.cells.map((_, rowIndex) => {
      const count = countValidNextWords(grid, rowIndex);
      return count > 0 ? count : null;
    });
  }, [grid]);

  const { cellSize, tileSize } = useMemo(() => {
    const screenWidth = Dimensions.get('window').width;
    const cell = Math.floor(screenWidth / layout.visibleColumns);
    const tile = cell - layout.tileSpacing;
    return { cellSize: cell, tileSize: tile };
  }, []);

  useEffect(() => {
    textInputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!currentPosition) return;
    const screenHeight = Dimensions.get('window').height;
    const rowYPosition = currentPosition.row * cellSize;
    const screenMiddle = screenHeight * 0.5;

    if (rowYPosition > screenMiddle) {
      const targetY = rowYPosition - screenHeight * 0.45;
      scrollViewRef.current?.scrollTo({ y: Math.max(0, targetY), animated: true });
    }
  }, [currentPosition, cellSize]);

  const badgeColumns = useMemo(() => {
    return grid.cells.map(row => {
      let lastAccessible = -1;
      for (let col = 0; col < row.length; col++) {
        if (row[col].accessible) lastAccessible = col;
      }
      return lastAccessible + 1 < grid.cols ? lastAccessible + 1 : -1;
    });
  }, [grid]);

  return (
    <View style={styles.container}>
      <Pressable style={{ flex: 1 }} onPress={() => textInputRef.current?.focus()}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
        >
          <View style={{ width: cellSize * grid.cols, height: cellSize * grid.rows }}>
            {grid.cells.map((row, rowIndex) => (
              <View key={rowIndex} style={[styles.row, { width: cellSize * grid.cols }]}>
                {row.map((cell, colIndex) => {
                  const showBadge = colIndex === badgeColumns[rowIndex];
                  const badgeCount = showBadge ? validNextWordCounts[rowIndex] : null;

                  return (
                    <CellView
                      key={`${rowIndex}-${colIndex}`}
                      cell={cell}
                      cellSize={cellSize}
                      tileSize={tileSize}
                      badgeCount={badgeCount}
                    />
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      </Pressable>

      <ErrorToast message={errorMessage} />

      <TextInput
        ref={textInputRef}
        style={styles.hiddenInput}
        onChangeText={handleKeyPress}
        onKeyPress={(e) => {
          if (e.nativeEvent.key === 'Backspace') {
            handleBackspace();
          }
        }}
        value=""
        autoCapitalize="characters"
        autoCorrect={false}
        keyboardType="default"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
  },
  hiddenInput: {
    position: 'absolute',
    top: -1000,
    left: 0,
    width: 1,
    height: 1,
  },
});
