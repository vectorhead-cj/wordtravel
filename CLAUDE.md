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

## Rule tiles

Rule tiles are the core mechanic. A cell can carry up to two rule tiles. Each tile constrains the relationship between the letter in that cell and the word in an adjacent row:

- **Hard match** — the letter in this cell must be identical to the letter at the same column position in the paired row.
- **Soft match** — the letter in this cell must appear *somewhere* in the target row's word.
- **Forbidden match** — the letter in this cell must *not* appear anywhere in the target row's word.

Soft and forbidden tiles can point to the row above, below, or both (bidirectional). Hard match tiles always pair a specific cell in one row with a specific cell in another.

## Puzzle generation & difficulty

Puzzles are generated from profiles that specify how many of each rule tile type to place and how many letters to pre-fill. Difficulty (easy/medium/hard) is validated by running Monte Carlo simulations: a puzzle is rated by what fraction of random auto-solve attempts succeed. If the success rate falls below the hard threshold, the puzzle is rejected and regenerated.

## Puzzle types

- **Open** — all word rows are blank; player fills everything.
- **Bridge** — start and end rows are pre-specified; the player bridges between these.
- **Semi** — only one word is pre-specified.
