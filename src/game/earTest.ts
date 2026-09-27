import { scaleNotesInRange, valueToMidi } from '../mapping/pitch';
import type { MappingConfig } from '../mapping/types';
import { pick, shuffle, type Rng } from './random';

export type Difficulty = 'easy' | 'medium' | 'hard';

/** How many scale steps apart the two clips are, per difficulty (inclusive). */
export const STEP_GAP: Record<Difficulty, [number, number]> = {
  easy: [5, Infinity],
  medium: [3, 4],
  hard: [1, 2],
};

export type QuestionKind = 'timeline' | 'region';

/** One thing that can be played as a clip: a year of a record, or an ocean region. */
export interface ClipItem {
  id: string;
  /** Short visible label, shown only after answering: "1985", "Coral Sea". */
  label: string;
  /** How to say it: "1985", "the Coral Sea". */
  spoken: string;
  value: number;
  /** Extra data for the reveal visual (year or region box). */
  year?: number;
  box?: [number, number, number, number];
}

export interface Question {
  kind: QuestionKind;
  datasetId: string;
  items: [ClipItem, ClipItem];
  midi: [number, number];
  /** Scale steps between the clips. */
  gap: number;
  ask: 'higher' | 'lower';
  prompt: string;
  /** Index of the correct clip. */
  answer: 0 | 1;
}

/** Position of a value in the mapping's scale (0 = lowest note). */
export function stepOf(value: number, cfg: MappingConfig): number {
  const notes = scaleNotesInRange(cfg.midiRange, cfg.root, cfg.scale);
  return notes.indexOf(valueToMidi(value, cfg));
}

/** A random pair whose pitch gap matches the difficulty, or null if the pool can't provide one. */
export function pickPair(pool: ClipItem[], cfg: MappingConfig, difficulty: Difficulty, rng: Rng): [ClipItem, ClipItem] | null {
  const [lo, hi] = STEP_GAP[difficulty];
  const steps = pool.map((it) => stepOf(it.value, cfg));
  const pairs: [number, number][] = [];
  for (let i = 0; i < pool.length; i++)
    for (let j = i + 1; j < pool.length; j++) {
      const g = Math.abs(steps[i] - steps[j]);
      if (g >= lo && g <= hi) pairs.push([i, j]);
    }
  if (pairs.length === 0) return null;
  const [i, j] = pick(rng, pairs);
  const ordered = shuffle(rng, [pool[i], pool[j]]);
  return [ordered[0], ordered[1]];
}

export interface AskWords {
  /** "had more sea ice" / "has warmer water" */
  higher: string;
  lower: string;
  /** "year" / "region" */
  noun: string;
  /** "Two years of Arctic sea ice." */
  intro: string;
}

export function makeQuestion(
  kind: QuestionKind,
  datasetId: string,
  pool: ClipItem[],
  cfg: MappingConfig,
  difficulty: Difficulty,
  words: AskWords,
  rng: Rng,
): Question | null {
  const pair = pickPair(pool, cfg, difficulty, rng);
  if (!pair) return null;
  const ask: 'higher' | 'lower' = rng() < 0.5 ? 'higher' : 'lower';
  const midi: [number, number] = [valueToMidi(pair[0].value, cfg), valueToMidi(pair[1].value, cfg)];
  const firstIsHigher = pair[0].value > pair[1].value;
  const answer: 0 | 1 = (ask === 'higher') === firstIsHigher ? 0 : 1;
  const verb = ask === 'higher' ? words.higher : words.lower;
  return {
    kind,
    datasetId,
    items: pair,
    midi,
    gap: Math.abs(stepOf(pair[0].value, cfg) - stepOf(pair[1].value, cfg)),
    ask,
    prompt: `${words.intro} Which ${words.noun} ${verb}: the first or the second?`,
    answer,
  };
}

export const ORDINAL = ['first', 'second'] as const;

/** Spoken explanation after answering. */
export function revealText(q: Question, choice: 0 | 1, unitSpoken: string, decimals: number, words: AskWords): string {
  const right = choice === q.answer;
  const win = q.items[q.answer];
  const lose = q.items[1 - q.answer];
  const f = (v: number) => v.toFixed(decimals);
  const verb = q.ask === 'higher' ? words.higher : words.lower;
  return (
    `${right ? 'Correct!' : 'Not quite.'} The ${ORDINAL[q.answer]}, ${win.spoken}, ${verb}: ` +
    `${f(win.value)} ${unitSpoken}, against ${f(lose.value)} for ${lose.spoken}. ` +
    `It was ${q.gap} ${q.gap === 1 ? 'step' : 'steps'} ${q.ask === 'higher' ? 'higher' : 'lower'} in pitch.`
  );
}

export interface Score {
  answered: number;
  correct: number;
  streak: number;
  bestStreak: number;
}

export const EMPTY_SCORE: Score = { answered: 0, correct: 0, streak: 0, bestStreak: 0 };

export function applyAnswer(s: Score, correct: boolean): Score {
  const streak = correct ? s.streak + 1 : 0;
  return {
    answered: s.answered + 1,
    correct: s.correct + (correct ? 1 : 0),
    streak,
    bestStreak: Math.max(s.bestStreak, streak),
  };
}

export function scoreText(s: Score): string {
  if (s.answered === 0) return 'No answers yet';
  const pct = Math.round((100 * s.correct) / s.answered);
  return `${s.correct} of ${s.answered} correct, ${pct} percent`;
}
