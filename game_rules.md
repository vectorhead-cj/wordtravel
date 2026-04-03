# Game rules

## Rule tiles

Rule tiles are the core mechanic. A cell can carry up to two rule modifiers, one per top/bottom half. Each modifier constrains the relationship between the letter in that cell and the word in an adjacent row (either previous or next):

- **Hard match** — the letter in this cell must be identical to the letter at the same column position in the paired row.
- **Soft match** — the letter in this cell must appear *somewhere* in the target row's word.
- **Forbidden match** — the letter in this cell must *not* appear anywhere in the target row's word.

**Soft match** and **forbidden** modifiers can point to the row above or below and don't pair with a specific cell in the target row. Therefore the visual cue for a modifier just affects the relevant half of the tile it's placed on (top if targeting previous row, bottom if targeting the next row). A **hard match** modifier, however, pairs with a specific cell, so a **hard match** pointing to the next row has a visual indicator on the bottom half of that tile, and the target cell in the next row has the corresponding **hard match** indicator on the top half of the cell.

## Fixed tiles

The generator may place fixed letter tiles, i.e. that the letter is pre-filled and not possible to change.

### Fixed words

* Depending on the puzzle modes, entire words may be fixed. In this case they must come from the **generator dictionary**.

## Puzzle modes

* **Open**: no fixed words (though fixed letters may appear)
* **Semi**: only last word is fixed
* **Bridge**: top and bottom words are fixed

## Puzzle generation

The following rules apply when generating a puzzle. Parameters are found in `config.ts`, and are specified by difficulty.

* A puzzle has 7 word rows.
* Permitted word lengths are 3, 4 and 5 letters (given by the `WORD_LENGTH_WEIGHTS` parameter). And the maximum number of consecutive words of the same length is specified by the `maxConsecutiveSameLength` parameter.
* Adjacent words must share at least one column. (At current word lengths and grid width, center-alignment is forced, but this is not an explicit constraint.)
* At most one fixed letter tile per row.
* The maximum number of **fixed tiles** (except for any fixed words) is specified by the `fixedTiles` parameter.
* Each non-fixed-word row must contain at least `minModifiersPerRow` modifier tiles (of any type, in any direction), ensuring every row is linked to both adjacent rows (either by one row constraining the next, or next row constraining the first) so that there are no isolated puzzle chunks. Fully-fixed word rows are exempt from this requirement unless `fixedWordRowsMayHaveNonHardModifiers` is true.
* When `fixedWordRowsMayHaveNonHardModifiers` is true, soft match and forbidden modifiers may be placed on cells within fully-fixed word rows. When false, fully-fixed word rows carry no modifiers.
* Fixed tiles may have any modifier in any direction, except the **hard match** modfier (as matching those are trivial for the player), though subject to the other constraints.
* Max rule modifiers per tile is specified by the `maxRulesPerCell` parameter. Specifically, only one modifier per half-tile (two modifiers on one tile must use one half each).
    * Permitted **soft match** and **forbidden** modifier directions are specified by the `permittedSoftAndForbiddenDirections` parameter, and may take the value `down` or `bidirectional`.
* A fixed letter tile must never be placed so that it fulfills a **hard** or **soft** modifier from another row.
* A fixed letter tile must never be placed so that it makes the puzzle impossible, i.e. a fixed `A` where the `A` is prohibited from an adjacent row.
* The first row in a puzzle should not contain upwards-facing modifiers, and the last row should not contain downwards-facing modifiers.
* A row may not contain only a forbidden modifier (in either direction), as this is too simple. Two forbidden is OK, if permitted by other settings.
* **Hard match** tiles can be chained to force the same letter vertically over more than 2 rows. Although implicitly permitted by the other rules, it's worth a mention here. The max chain length is specified by the `hardMatchMaxChainLength` parameter.
* A puzzle must have at least some modifiers of each type, this is specified by the parameters `minHardMatchPairs` (not tiles, since **hard match** always comes in pairs), `minSoftMatchModifiers` and `minForbiddenModifiers`.
* When validating a generated puzzle, at least some number of possible words must be possible in each step during a random solve. Otherwise that run counts as invalid. This is specified by the `minCandidatesPerRow` parameter. (Otherwise there might be tight bottlenecks in solving the puzzle).
* The following cross-rule conflict is forbidden: A row has a soft match (or hard match) requiring a letter in an adjacent row, and also a forbidden modifier banning that same letter from the same adjacent row.
* The fixed letter alphabet (letters eligible for fixed tiles) is restricted to common letters: `ABCDEFGHIKLMNOPRSTUWY`. Rare letters (J, Q, V, X, Z) are excluded.
* Fixed words are restricted to lengths 3–4 (shorter words make better anchors).
* All feasibility checks use the **generator dictionary** (frequency-filtered), not the full player dictionary.

### Retry budgets

The generator uses nested retry loops. These budgets cap wasted work without being so tight that valid puzzles are missed:

* **Outer generation loop**: up to 500 attempts (each produces a candidate puzzle, simulates difficulty, accepts or rejects).
* **Config generation** (word length sequence): up to 20 attempts to satisfy `maxConsecutiveSameLength`.
* **Hard-match chain placement**: up to 5 local retries (clear and re-place chains if validation fails).
* **Soft/forbidden tile placement**: up to 5 local retries (clear and re-place if rule conflicts or feasibility fails).
* **Per-modifier placement attempts**: up to 100 random cell picks per tile type before giving up on that tile.

### Algorithm for generating a puzzle

All puzzles are randomly generated.

The difficulty metric for a puzzle is defined as the share of random solutions that solve the puzzle:
* A word is picked from the indexed **generator dictionary** (not the full dictionary) for each row, from the subset of words that solve the conditions imposed on it from adjacent rows. This is where the `minCandidatesPerRow` parameter comes in, if there are fewer possible words, then the solver stops immediately and classifies as failed.
* The puzzle is solved top -> bottom or bottom -> top at random
* The difficulty thresholds are given by the `DIFFICULTY_THRESHOLDS` parameter

1. Generate the word lengths, positioning according and minimum modifiers according to the rules
    * This includes generating **hard match chains** according to settings
    * **If any row can't be satisfied, restart**
    * Measure number of candidates per row from the **generator dictionary**, restart if below the threshold
2. Generate additional modifiers at random, and measure number of candidates per row. If the added rule would bring the number of candidates below the threshold then stop before adding it.
    * The additions should be random but weighted so that hard/soft/forbidden are added according to the `minHardMatchPairs`, `minSoftMatchModifiers` and `minForbiddenModifiers` relative weighting
3. Measure whole puzzle difficulty
    * If in the relevant range, stop. We're done.
    * If too low, then go to step 2, but don't add anything affecting rows that already have lead to a "stop" (since they are already at an appropriate level)
    * If too high, then start over from step 1.
