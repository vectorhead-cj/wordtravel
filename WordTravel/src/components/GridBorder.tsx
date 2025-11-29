import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Grid } from '../engine/types';

interface GridBorderProps {
  grid: Grid;
  cellSize: number;
}

export function GridBorder({ grid, cellSize }: GridBorderProps) {
  const pathData = useMemo(() => {
    return calculateBorderPath(grid, cellSize);
  }, [grid, cellSize]);

  if (!pathData) return null;

  const width = grid.cols * cellSize;
  const height = grid.rows * cellSize;

  return (
    <Svg
      width={width}
      height={height}
      style={styles.svg}
      pointerEvents="none"
    >
      <Path
        d={pathData}
        stroke="#333"
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function calculateBorderPath(grid: Grid, cellSize: number): string | null {
  const { rows, cols, cells } = grid;
  
  type EdgeKey = string;
  type Edge = { x1: number; y1: number; x2: number; y2: number };
  
  const edges = new Map<EdgeKey, Edge>();
  
  const addEdge = (x1: number, y1: number, x2: number, y2: number) => {
    const key = `${x1},${y1}-${x2},${y2}`;
    const reverseKey = `${x2},${y2}-${x1},${y1}`;
    
    if (edges.has(reverseKey)) {
      edges.delete(reverseKey);
    } else {
      edges.set(key, { x1, y1, x2, y2 });
    }
  };
  
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (cells[row][col].accessible) {
        const x = col * cellSize;
        const y = row * cellSize;
        
        if (row === 0 || !cells[row - 1][col].accessible) {
          addEdge(x, y, x + cellSize, y);
        }
        if (row === rows - 1 || !cells[row + 1][col].accessible) {
          addEdge(x + cellSize, y + cellSize, x, y + cellSize);
        }
        if (col === 0 || !cells[row][col - 1].accessible) {
          addEdge(x, y + cellSize, x, y);
        }
        if (col === cols - 1 || !cells[row][col + 1].accessible) {
          addEdge(x + cellSize, y, x + cellSize, y + cellSize);
        }
      }
    }
  }
  
  if (edges.size === 0) return null;
  
  const edgeArray = Array.from(edges.values());
  const paths: string[] = [];
  const used = new Set<Edge>();
  
  for (const startEdge of edgeArray) {
    if (used.has(startEdge)) continue;
    
    const pathPoints: string[] = [];
    let current: Edge | undefined = startEdge;
    const startX = current.x1;
    const startY = current.y1;
    
    pathPoints.push(`M ${startX} ${startY}`);
    
    let iterations = 0;
    const maxIterations = edgeArray.length * 2;
    
    while (current && iterations < maxIterations) {
      iterations++;
      
      if (used.has(current)) {
        break;
      }
      
      used.add(current);
      pathPoints.push(`L ${current.x2} ${current.y2}`);
      
      if (current.x2 === startX && current.y2 === startY) {
        break;
      }
      
      current = edgeArray.find(
        e => !used.has(e) && e.x1 === current!.x2 && e.y1 === current!.y2
      );
    }
    
    if (pathPoints.length > 2) {
      pathPoints.push('Z');
      paths.push(pathPoints.join(' '));
    }
  }
  
  return paths.join(' ');
}

const styles = StyleSheet.create({
  svg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});

