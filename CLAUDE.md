# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

The React Native app lives in `WordTravel/`. Run all commands from there.

```bash
npm start              # Start Metro dev server
npm run ios            # Run on iOS simulator
npm run android        # Run on Android
npm run lint           # ESLint
npm run test           # Run all Jest tests
npm run puzzle:lab     # Run puzzleLaboratory integration tests (no cache)
npx jest path/to/test  # Run a single test file
```

## What the game is

WordTravel is a word puzzle game. Players fill a grid of word rows, where each row must contain a valid dictionary word. The challenge comes from **rule tiles** — constraints placed on cells that link rows together, forcing the words to relate to each other.

The game has two modes: **Puzzle** (timed, scored) and **Action** (sequential row validation). It flows linearly: select mode → difficulty → play → results.

## The grid

The grid has a fixed number of columns (currently 5) and multiple word rows. Words can be 3–5 letters, center-aligned within the columns. Not every cell in a row is always part of a word. Some cells may be pre-filled (locked/fixed) as part of the puzzle.

Rule tiles and rules for generating a puzzle are found in `game_rules.md`.
