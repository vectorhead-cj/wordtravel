import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme';

interface ErrorToastProps {
  message: string | null;
}

export function ErrorToast({ message }: ErrorToastProps) {
  if (!message) return null;

  return (
    <View style={styles.errorPopup}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  errorPopup: {
    position: 'absolute',
    top: 120,
    alignSelf: 'center',
    backgroundColor: colors.errorPopup,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    zIndex: 30,
    elevation: 30,
  },
  errorText: {
    color: colors.errorText,
    fontSize: 15,
    fontWeight: '600',
  },
});

