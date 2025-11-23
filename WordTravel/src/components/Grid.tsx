import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Grid as GridType } from '../engine/types';

interface GridProps {
  grid: GridType;
}

export function Grid({ grid }: GridProps) {
  return (
    <View style={styles.container}>
      {/* Grid implementation will go here */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

