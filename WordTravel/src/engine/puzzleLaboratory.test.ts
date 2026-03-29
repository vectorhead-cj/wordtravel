import { PUZZLE_CONFIG } from './config';
import { generatorDictionary } from './Dictionary';
import { simulatePuzzleDifficulty, solveFromHere } from './DifficultySimulator';
import { parseGrid } from './PuzzleNotation';
import { PUZZLE_NOTATION } from './puzzleLaboratory.fixture';

const notation = (process.env.WT_NOTATION ?? PUZZLE_NOTATION).trim();

const simTrialsRaw = Number(
  process.env.WT_SIM_TRIALS ?? PUZZLE_CONFIG.DIFFICULTY_SIMULATION_TRIALS,
);
const simTrials =
  Number.isFinite(simTrialsRaw) && simTrialsRaw > 0
    ? Math.floor(simTrialsRaw)
    : PUZZLE_CONFIG.DIFFICULTY_SIMULATION_TRIALS;

const solveTrialsRaw = Number(process.env.WT_TRIALS ?? '1000');
const solveTrials =
  Number.isFinite(solveTrialsRaw) && solveTrialsRaw > 0 ? Math.floor(solveTrialsRaw) : 1000;

(notation ? describe : describe.skip)('puzzle laboratory (paste into puzzleLaboratory.fixture.ts)', () => {
  beforeAll(() => {
    generatorDictionary.initialize();
  });

  it('simulatePuzzleDifficulty + solveFromHere', () => {
    const grid = parseGrid(notation, { lowercaseLettersAsPlayerFill: true });

    const sim = simulatePuzzleDifficulty(grid, simTrials);
    const solve = solveFromHere(grid, solveTrials);

    // eslint-disable-next-line no-console
    console.log(
      [
        '',
        '--- puzzle laboratory ---',
        notation,
        '',
        `simulatePuzzleDifficulty (trials=${simTrials})`,
        `  successRate: ${sim.successRate}`,
        `  difficulty:  ${String(sim.difficulty)}`,
        '',
        `solveFromHere (trials=${solveTrials})`,
        `  successRate: ${solve.successRate}`,
        `  solvable:    ${solve.solution !== null}`,
        '',
      ].join('\n'),
    );

    expect(sim.trials).toBe(simTrials);
  });
});
