import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Grid as GridType, Cell, GameMode } from '../engine/types';
import { dictionary } from '../engine/Dictionary';

interface GridProps {
  grid: GridType;
  mode: GameMode;
  onGridChange: (grid: GridType) => void;
  onRowValidated: (row: number, isValid: boolean) => void;
}

export function Grid({ grid, mode, onGridChange, onRowValidated }: GridProps) {
  const [currentRow, setCurrentRow] = useState(1);
  const [currentCol, setCurrentCol] = useState(2);
  const scrollViewRef = useRef<ScrollView>(null);
  const textInputRef = useRef<TextInput>(null);

  const cellSize = useMemo(() => {
    const screenWidth = Dimensions.get('window').width;
    const visibleColumns = 8;
    return Math.floor(screenWidth / visibleColumns);
  }, []);

  useEffect(() => {
    textInputRef.current?.focus();
  }, []);

  useEffect(() => {
    const screenHeight = Dimensions.get('window').height;
    const targetY = currentRow * cellSize - screenHeight * 0.25;
    scrollViewRef.current?.scrollTo({ y: Math.max(0, targetY), animated: true });
  }, [currentRow, cellSize]);

  const handleKeyPress = (text: string) => {
    if (!text || text.length === 0) return;

    const letter = text.slice(-1).toUpperCase();
    if (!/^[A-Z]$/.test(letter)) return;

    const currentCell = grid.cells[currentRow][currentCol];
    if (mode === 'action' && currentCell.validation !== 'none') {
      return;
    }

    const newGrid = { ...grid };
    newGrid.cells = grid.cells.map(row => row.map(cell => ({ ...cell })));
    newGrid.cells[currentRow][currentCol].letter = letter;
    newGrid.cells[currentRow][currentCol].state = 'filled';

    onGridChange(newGrid);

    const shouldValidate = checkIfRowComplete(newGrid, currentRow);
    if (shouldValidate) {
      validateCurrentRow(newGrid);
    } else {
      moveToNextCell();
    }
  };

  const checkIfRowComplete = (checkGrid: GridType, row: number): boolean => {
    for (let col = 0; col < checkGrid.cols; col++) {
      const cell = checkGrid.cells[row][col];
      if (cell.accessible && !cell.letter) {
        return false;
      }
    }
    return true;
  };

  const validateCurrentRow = (gridToValidate: GridType) => {
    let word = '';
    for (let col = 0; col < gridToValidate.cols; col++) {
      const cell = gridToValidate.cells[currentRow][col];
      if (cell.accessible && cell.letter) {
        word += cell.letter;
      }
    }

    const isValid = word.length === 5 && dictionary.isValidWord(word);
    const validatedGrid = { ...gridToValidate };
    validatedGrid.cells = gridToValidate.cells.map(row => row.map(cell => ({ ...cell })));

    for (let col = 0; col < validatedGrid.cols; col++) {
      const cell = validatedGrid.cells[currentRow][col];
      if (cell.accessible) {
        cell.validation = isValid ? 'correct' : 'incorrect';
        if (mode === 'action') {
          cell.state = 'locked';
        }
      }
    }

    onGridChange(validatedGrid);
    onRowValidated(currentRow, isValid);

    if (isValid) {
      setTimeout(() => {
        moveToNextRow();
      }, 300);
    }
  };

  const moveToNextRow = () => {
    let nextRow = currentRow + 1;
    let nextCol = 2;

    while (nextRow < grid.rows) {
      while (nextCol < grid.cols && !grid.cells[nextRow][nextCol].accessible) {
        nextCol++;
      }
      if (nextCol < grid.cols) {
        setCurrentRow(nextRow);
        setCurrentCol(nextCol);
        return;
      }
      nextRow++;
      nextCol = 2;
    }
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
    const cell = grid.cells[row][col];
    if (!cell.accessible) return;
    
    if (mode === 'action' && cell.validation !== 'none') {
      return;
    }

    setCurrentRow(row);
    setCurrentCol(col);
    textInputRef.current?.focus();
  };

  const renderCell = (cell: Cell, row: number, col: number) => {
    const isActive = row === currentRow && col === currentCol;
    
    let validationStyle = {};
    if (cell.validation === 'correct') {
      validationStyle = styles.cellCorrect;
    } else if (cell.validation === 'incorrect') {
      validationStyle = styles.cellIncorrect;
    }
    
    return (
      <TouchableOpacity
        key={`${row}-${col}`}
        style={[
          styles.cell,
          { width: cellSize, height: cellSize },
          cell.accessible ? styles.cellAccessible : styles.cellInaccessible,
          isActive && styles.cellActive,
          validationStyle,
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
          <View key={rowIndex} style={[styles.row, { width: cellSize * grid.cols }]}>
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
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    justifyContent: 'center',
    alignItems: 'center',
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
  cellCorrect: {
    borderColor: '#006400',
    borderWidth: 3,
  },
  cellIncorrect: {
    borderColor: '#8B0000',
    borderWidth: 3,
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


