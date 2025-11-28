import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  Text,
} from 'react-native';
import { Grid as GridType, Cell, GameMode, SameLetterPositionTile } from '../engine/types';
import { 
  isRowComplete, 
  validateAndUpdateRow, 
  findFirstAccessibleCell, 
  syncPairedCell,
  getRowValidationState,
  RowValidationState 
} from '../engine/GameLogic';

interface GridProps {
  grid: GridType;
  mode: GameMode;
  onGridChange: (grid: GridType) => void;
  onRowValidated: (row: number, isValid: boolean) => void;
}

export function Grid({ grid, mode, onGridChange, onRowValidated }: GridProps) {
  const initialPosition = useMemo(() => findFirstAccessibleCell(grid), [grid]);
  const [currentRow, setCurrentRow] = useState(initialPosition.row);
  const [currentCol, setCurrentCol] = useState(initialPosition.col);
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

    let newGrid = { ...grid };
    newGrid.cells = grid.cells.map(row => row.map(cell => ({ ...cell })));
    newGrid.cells[currentRow][currentCol].letter = letter;
    newGrid.cells[currentRow][currentCol].state = 'filled';

    newGrid = syncPairedCell(newGrid, currentRow, currentCol, letter);

    onGridChange(newGrid);

    const shouldValidate = isRowComplete(newGrid, currentRow);
    if (shouldValidate) {
      const { validatedGrid, isValid } = validateAndUpdateRow(newGrid, currentRow, mode);
      onGridChange(validatedGrid);
      onRowValidated(currentRow, isValid);
    }
    
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
    const cell = grid.cells[row][col];
    if (!cell.accessible) return;
    
    if (mode === 'action' && cell.validation !== 'none') {
      return;
    }

    setCurrentRow(row);
    setCurrentCol(col);
    textInputRef.current?.focus();
  };

  const getDebugInfoForCell = (row: number, col: number): RowValidationState | null => {
    const rowCells = grid.cells[row];
    
    let firstAccessible = -1;
    let lastAccessible = -1;
    
    for (let c = 0; c < rowCells.length; c++) {
      if (rowCells[c].accessible) {
        if (firstAccessible === -1) firstAccessible = c;
        lastAccessible = c;
      }
    }
    
    if (firstAccessible !== -1 && col === lastAccessible + 1 && !rowCells[col].accessible) {
      return getRowValidationState(grid, row);
    }
    
    return null;
  };

  const renderCell = (cell: Cell, row: number, col: number) => {
    const isActive = row === currentRow && col === currentCol;
    
    let letterColorStyle = {};
    if (cell.validation === 'correct') {
      letterColorStyle = styles.letterCorrect;
    } else if (cell.validation === 'incorrect') {
      letterColorStyle = styles.letterIncorrect;
    }
    
    const ruleTile = cell.ruleTile;
    const showEqualsTop = ruleTile?.type === 'sameLetterPosition' && 
      (ruleTile as SameLetterPositionTile).constraint.position === 'bottom';
    const showEqualsBottom = ruleTile?.type === 'sameLetterPosition' && 
      (ruleTile as SameLetterPositionTile).constraint.position === 'top';
    const showDownArrow = ruleTile?.type === 'sameLetter';
    
    const debugInfo = getDebugInfoForCell(row, col);
    
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
          {showEqualsTop && (
            <Text style={styles.equalsTop}>=</Text>
          )}
          {cell.letter && (
            <View style={styles.letterContainer}>
              <TextInput
                style={[styles.letter, letterColorStyle]}
                value={cell.letter}
                editable={false}
              />
            </View>
          )}
          {showEqualsBottom && (
            <Text style={styles.equalsBottom}>=</Text>
          )}
          {showDownArrow && (
            <Text style={styles.downArrow}>↓</Text>
          )}
          {debugInfo && (
            <View style={styles.debugContainer}>
              <Text style={[styles.debugSymbol, styles.debugTopLeft, debugInfo.spelling ? styles.debugValid : styles.debugInvalid]}>
                Abc
              </Text>
              {debugInfo.hasSameLetterPositionTile && (
                <Text style={[styles.debugSymbol, styles.debugTopRight, debugInfo.sameLetterPosition ? styles.debugValid : styles.debugInvalid]}>
                  =
                </Text>
              )}
              {debugInfo.hasSameLetterTile && (
                <Text style={[styles.debugSymbol, styles.debugBottomLeft, debugInfo.sameLetter ? styles.debugValid : styles.debugInvalid]}>
                  ↓
                </Text>
              )}
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
    backgroundColor: '#dddddd',
    borderWidth: 0.5,
    borderColor: '#666',
  },
  cellAccessible: {
    backgroundColor: '#ffffff',
    borderWidth: 0.5,
	//borderBottomWidth: 6,
    borderColor: '#666',
  },
  cellActive: {
	  backgroundColor: '#f0f8ff',
	  borderWidth: 0.5,
	  borderColor: '#666',
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
  letterCorrect: {
    color: '#006400',
  },
  letterIncorrect: {
    color: '#8B0000',
  },
  equalsTop: {
    position: 'absolute',
    top: 2,
    fontSize: 12,
    color: '#666',
    fontWeight: 'bold',
  },
  equalsBottom: {
    position: 'absolute',
    bottom: 2,
    fontSize: 12,
    color: '#666',
    fontWeight: 'bold',
  },
  downArrow: {
    position: 'absolute',
    bottom: 2,
    fontSize: 14,
    color: '#666',
    fontWeight: 'bold',
  },
  debugContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  debugSymbol: {
    position: 'absolute',
    fontSize: 10,
    fontWeight: 'bold',
  },
  debugTopLeft: {
    top: 2,
    left: 2,
  },
  debugTopRight: {
    top: 2,
    right: 2,
  },
  debugBottomLeft: {
    bottom: 2,
    left: 2,
  },
  debugValid: {
    color: '#00AA00',
  },
  debugInvalid: {
    color: '#CC0000',
  },
  hiddenInput: {
    position: 'absolute',
    top: -1000,
    left: 0,
    width: 1,
    height: 1,
  },
});


