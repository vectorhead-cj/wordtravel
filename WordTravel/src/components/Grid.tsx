import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Grid as GridType, Cell } from '../engine/types';

interface GridProps {
  grid: GridType;
  onGridChange: (grid: GridType) => void;
}

const CELL_MARGIN = 4;
const SIDE_PADDING = 16;

export function Grid({ grid, onGridChange }: GridProps) {
  const [currentRow, setCurrentRow] = useState(1);
  const [currentCol, setCurrentCol] = useState(1);
  const scrollViewRef = useRef<ScrollView>(null);
  const textInputRef = useRef<TextInput>(null);

  const cellSize = useMemo(() => {
    const screenWidth = Dimensions.get('window').width;
    const availableWidth = screenWidth - SIDE_PADDING * 2;
    const totalMarginWidth = CELL_MARGIN * 2 * grid.cols;
    const cellsTotalWidth = availableWidth - totalMarginWidth;
    return Math.floor(cellsTotalWidth / grid.cols);
  }, [grid.cols]);

  useEffect(() => {
    textInputRef.current?.focus();
  }, []);

  useEffect(() => {
    const screenHeight = Dimensions.get('window').height;
    const targetY = currentRow * (cellSize + CELL_MARGIN * 2) - screenHeight * 0.25;
    scrollViewRef.current?.scrollTo({ y: Math.max(0, targetY), animated: true });
  }, [currentRow, cellSize]);

  const handleKeyPress = (text: string) => {
    if (!text || text.length === 0) return;

    const letter = text.slice(-1).toUpperCase();
    if (!/^[A-Z]$/.test(letter)) return;

    const newGrid = { ...grid };
    newGrid.cells = grid.cells.map(row => row.map(cell => ({ ...cell })));
    newGrid.cells[currentRow][currentCol].letter = letter;
    newGrid.cells[currentRow][currentCol].state = 'filled';

    onGridChange(newGrid);

    moveToNextCell();
  };

  const moveToNextCell = () => {
    let nextRow = currentRow;
    let nextCol = currentCol + 1;

    while (nextCol < grid.cols && !grid.cells[nextRow][nextCol].accessible) {
      nextCol++;
    }

    if (nextCol >= grid.cols) {
      nextRow++;
      nextCol = 0;
      
      while (nextRow < grid.rows) {
        while (nextCol < grid.cols && !grid.cells[nextRow][nextCol].accessible) {
          nextCol++;
        }
        if (nextCol < grid.cols) break;
        nextRow++;
        nextCol = 0;
      }
    }

    if (nextRow < grid.rows && nextCol < grid.cols) {
      setCurrentRow(nextRow);
      setCurrentCol(nextCol);
    }
  };

  const handleCellPress = (row: number, col: number) => {
    if (!grid.cells[row][col].accessible) return;
    setCurrentRow(row);
    setCurrentCol(col);
    textInputRef.current?.focus();
  };

  const renderCell = (cell: Cell, row: number, col: number) => {
    const isActive = row === currentRow && col === currentCol;
    
    return (
      <TouchableOpacity
        key={`${row}-${col}`}
        style={[
          styles.cell,
          { width: cellSize, height: cellSize },
          cell.accessible ? styles.cellAccessible : styles.cellInaccessible,
          isActive && styles.cellActive,
        ]}
        onPress={() => handleCellPress(row, col)}
        activeOpacity={cell.accessible ? 0.7 : 1}
      >
        <View style={styles.cellContent}>
          {cell.letter && (
            <View style={styles.letterContainer}>
              <TextInput
                style={styles.letter}
                value={cell.letter}
                editable={false}
              />
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        {grid.cells.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.row}>
            {row.map((cell, colIndex) => renderCell(cell, rowIndex, colIndex))}
          </View>
        ))}
      </ScrollView>

      <TextInput
        ref={textInputRef}
        style={styles.hiddenInput}
        onChangeText={handleKeyPress}
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
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: CELL_MARGIN,
  },
  cell: {
    marginHorizontal: CELL_MARGIN,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
  },
  cellInaccessible: {
    backgroundColor: '#e0e0e0',
    borderWidth: 1,
    borderColor: '#d0d0d0',
  },
  cellAccessible: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#999',
  },
  cellActive: {
    borderColor: '#007AFF',
    borderWidth: 3,
    backgroundColor: '#f0f8ff',
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
    color: '#333',
    textAlign: 'center',
  },
  hiddenInput: {
    position: 'absolute',
    top: -1000,
    left: 0,
    width: 1,
    height: 1,
  },
});


