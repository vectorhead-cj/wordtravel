import React, { useState } from 'react';
import { StatusBar, StyleSheet, useColorScheme, View } from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { StartScreen } from './src/screens/StartScreen';
import { GameScreen } from './src/screens/GameScreen';
import { ResultScreen } from './src/screens/ResultScreen';
import { GameMode, GameResult } from './src/engine/types';

type Screen = 'start' | 'game' | 'result';

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const safeAreaInsets = useSafeAreaInsets();
  const [currentScreen, setCurrentScreen] = useState<Screen>('start');
  const [gameMode, setGameMode] = useState<GameMode>('puzzle');
  const [gameResult, setGameResult] = useState<GameResult | null>(null);

  const handleSelectMode = (mode: GameMode) => {
    setGameMode(mode);
    setCurrentScreen('game');
  };

  const handleGameComplete = (result: GameResult) => {
    setGameResult(result);
    setCurrentScreen('result');
  };

  const handleBackToMenu = () => {
    setCurrentScreen('start');
    setGameResult(null);
  };

  const handleBackFromGame = () => {
    setCurrentScreen('start');
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'start':
        return <StartScreen onSelectMode={handleSelectMode} />;
      case 'game':
        return (
          <GameScreen
            mode={gameMode}
            onGameComplete={handleGameComplete}
            onBack={handleBackFromGame}
          />
        );
      case 'result':
        return gameResult ? (
          <ResultScreen result={gameResult} onBackToMenu={handleBackToMenu} />
        ) : null;
    }
  };

  return (
    <View style={[styles.container, { paddingTop: safeAreaInsets.top }]}>
      {renderScreen()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});

export default App;
