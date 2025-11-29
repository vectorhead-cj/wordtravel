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
import { Grid as GridType, Cell, GameMode, SameLetterPositionTile, SameLetterTile } from '../engine/types';
import { 
  isRowComplete, 
  validateAndUpdateRow, 
  findFirstAccessibleCell, 
  syncPairedCell,
  getRowValidationState,
  RowValidationState 
} from '../engine/GameLogic';
import { GridBorder } from './GridBorder';

interface GridProps {
  grid: GridType;
  mode: GameMode;
  onGridChange: (grid: GridType) => void;
  onRowValidated: (row: number, isValid: boolean) => void;
  showRuleHelpers: boolean;
}

export function Grid({ grid, mode, onGridChange, onRowValidated, showRuleHelpers: _showRuleHelpers }: GridProps) {
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
    const rowYPosition = currentRow * cellSize;
    const screenMiddle = screenHeight * 0.5;
    
    // Only scroll if row is below the middle of the screen
    if (rowYPosition > screenMiddle) {
      // Position row just above the middle (at 45% of screen height)
      const targetY = rowYPosition - screenHeight * 0.45;
      scrollViewRef.current?.scrollTo({ y: Math.max(0, targetY), animated: true });
    }
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

  const moveToPreviousCell = () => {
    let prevRow = currentRow;
    let prevCol = currentCol - 1;

    while (prevCol >= 0 && !grid.cells[prevRow][prevCol].accessible) {
      prevCol--;
    }

    if (prevCol < 0 && prevRow > 0) {
      prevRow--;
      prevCol = grid.cols - 1;
      
      while (prevRow >= 0) {
        while (prevCol >= 0 && !grid.cells[prevRow][prevCol].accessible) {
          prevCol--;
        }
        if (prevCol >= 0) break;
        prevRow--;
        prevCol = grid.cols - 1;
      }
    }

    if (prevRow >= 0 && prevCol >= 0) {
      setCurrentRow(prevRow);
      setCurrentCol(prevCol);
    }
  };

  const handleBackspace = () => {
    const currentCell = grid.cells[currentRow][currentCol];
    if (mode === 'action' && currentCell.validation !== 'none') {
      return;
    }

    let newGrid = { ...grid };
    newGrid.cells = grid.cells.map(row => row.map(cell => ({ ...cell })));
    newGrid.cells[currentRow][currentCol].letter = '';
    newGrid.cells[currentRow][currentCol].state = 'empty';

    newGrid = syncPairedCell(newGrid, currentRow, currentCol, '');

    onGridChange(newGrid);
    moveToPreviousCell();
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

  const getRowValidation = (row: number): RowValidationState | null => {
    if (!isRowComplete(grid, row)) {
      return null;
    }
    return getRowValidationState(grid, row);
  };

  const isRowValidated = (row: number): boolean => {
    return grid.cells[row].some(cell => cell.validation !== 'none');
  };

  const renderCell = (cell: Cell, row: number, col: number) => {
    const isActive = row === currentRow && col === currentCol;
    const rowValidation = getRowValidation(row);
    const validated = isRowValidated(row);
    
    const ruleTile = cell.ruleTile;
    const showEqualsTop = ruleTile?.type === 'sameLetterPosition' && 
      (ruleTile as SameLetterPositionTile).constraint.position === 'bottom';
    const showEqualsBottom = ruleTile?.type === 'sameLetterPosition' && 
      (ruleTile as SameLetterPositionTile).constraint.position === 'top';
    const showDownArrow = ruleTile?.type === 'sameLetter';
    
    const getSameLetterPositionColor = () => {
      if (ruleTile?.type !== 'sameLetterPosition') return styles.symbolGrey;
      const constraint = (ruleTile as SameLetterPositionTile).constraint;
      const pairedCell = grid.cells[constraint.pairedRow][constraint.pairedCol];
      
      if (!cell.letter || !pairedCell.letter) return styles.symbolGrey;
      return cell.letter === pairedCell.letter ? styles.symbolGreen : styles.symbolRed;
    };
    
    const getSameLetterColor = () => {
      if (ruleTile?.type !== 'sameLetter') return styles.symbolGrey;
      const constraint = (ruleTile as SameLetterTile).constraint;
      
      if (!cell.letter) return styles.symbolGrey;
      
      const nextRowCells = grid.cells[constraint.nextRow];
      const hasLetter = nextRowCells.some(c => c.accessible && c.letter === cell.letter);
      
      const nextRowComplete = nextRowCells.every(c => !c.accessible || c.letter);
      if (!nextRowComplete) return styles.symbolGrey;
      
      return hasLetter ? styles.symbolGreen : styles.symbolRed;
    };
    
    let letterColorStyle = {};
    if (validated && rowValidation && cell.accessible) {
      const allRulesPass = rowValidation.spelling && 
                           rowValidation.uniqueWords && 
                           (!rowValidation.hasSameLetterPositionTile || rowValidation.sameLetterPosition) &&
                           (!rowValidation.hasSameLetterTile || rowValidation.sameLetter);
      
      letterColorStyle = allRulesPass ? styles.letterGreen : styles.letterRed;
    }
    
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
            <Text style={[styles.equalsTop, getSameLetterPositionColor()]}>●</Text>
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
            <Text style={[styles.equalsBottom, getSameLetterPositionColor()]}>●</Text>
          )}
          {showDownArrow && (
            <Text style={[styles.downArrow, getSameLetterColor()]}>○</Text>
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
        <View style={{ width: cellSize * grid.cols, height: cellSize * grid.rows }}>
          {grid.cells.map((row, rowIndex) => (
            <View key={rowIndex} style={[styles.row, { width: cellSize * grid.cols }]}>
              {row.map((cell, colIndex) => renderCell(cell, rowIndex, colIndex))}
            </View>
          ))}
          <GridBorder grid={grid} cellSize={cellSize} />
        </View>
      </ScrollView>

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
	//borderBottomWidth: 2,
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
  letterGreen: {
    color: '#008800',
  },
  letterRed: {
    color: '#880000',
  },
  symbolGrey: {
    color: '#999',
  },
  symbolGreen: {
    color: '#008800',
  },
  symbolRed: {
    color: '#880000',
  },
  equalsTop: {
    position: 'absolute',
    top: 2,
    fontSize: 8,
    fontWeight: 'bold',
  },
  equalsBottom: {
    position: 'absolute',
    bottom: 2,
    fontSize: 8,
    fontWeight: 'bold',
  },
  downArrow: {
    position: 'absolute',
    bottom: 2,
    fontSize: 8,
    fontWeight: 'bold',
  },
  hiddenInput: {
    position: 'absolute',
    top: -1000,
    left: 0,
    width: 1,
    height: 1,
  },
});


