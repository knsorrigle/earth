import { describe, expect, it } from 'vitest';
import { applyAnswer, EMPTY_SCORE, makeQuestion, pickPair, revealText, scoreText, stepOf, STEP_GAP, type ClipItem } from './earTest';
import { mulberry32, shuffle } from './random';
import type { MappingConfig } from '../mapping/types';

const cfg: MappingConfig = {
  domain: [3, 8],
  midiRange: [50, 79],
  scale: 'minorPentatonic',
  root: 57,
  referenceYear: 1979,
  higherMeans: 'more sea ice',
  lowerMeans: 'less sea ice',
};
const words = { higher: 'had more sea ice', lower: 'had less sea ice', noun: 'year', intro: 'Two years of Arctic sea ice.' };

const pool: ClipItem[] = [
  { id: '1985', label: '1985', spoken: '1985', value: 6.7, year: 1985 },
  { id: '2012', label: '2012', spoken: '2012', value: 3.57, year: 2012 },
  { id: '2024', label: '2024', spoken: '2024', value: 4.35, year: 2024 },
  { id: '1996', label: '1996', spoken: '1996', value: 7.58, year: 1996 },
  { id: '2007', label: '2007', spoken: '2007', value: 4.27, year: 2007 },
];

describe('random', () => {
  it('is reproducible', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it('shuffle keeps all items', () => {
    expect(shuffle(mulberry32(1), [1, 2, 3, 4]).sort()).toEqual([1, 2, 3, 4]);
  });
});

describe('pickPair', () => {
  it('respects the difficulty gap', () => {
    for (const d of ['easy', 'medium', 'hard'] as const) {
      for (let seed = 1; seed < 30; seed++) {
        const pair = pickPair(pool, cfg, d, mulberry32(seed));
        if (!pair) continue;
        const gap = Math.abs(stepOf(pair[0].value, cfg) - stepOf(pair[1].value, cfg));
        expect(gap).toBeGreaterThanOrEqual(STEP_GAP[d][0]);
        expect(gap).toBeLessThanOrEqual(STEP_GAP[d][1]);
      }
    }
  });
  it('never pairs clips on the same note', () => {
    const same = [pool[2], { ...pool[4], id: 'x' }]; // 4.35 and 4.27 share a note
    expect(stepOf(same[0].value, cfg)).toBe(stepOf(same[1].value, cfg));
    expect(pickPair(same, cfg, 'hard', mulberry32(3))).toBeNull();
  });
});

describe('makeQuestion', () => {
  it('answer points at the clip that matches the question', () => {
    for (let seed = 1; seed < 40; seed++) {
      const q = makeQuestion('timeline', 'ice', pool, cfg, 'easy', words, mulberry32(seed))!;
      const [a, b] = q.items;
      const higherIdx = a.value > b.value ? 0 : 1;
      expect(q.answer).toBe(q.ask === 'higher' ? higherIdx : 1 - higherIdx);
      expect(q.prompt).toMatch(/^Two years of Arctic sea ice\. Which year had (more|less) sea ice: the first or the second\?$/);
    }
  });
  it('reveal text explains with values', () => {
    const q = makeQuestion('timeline', 'ice', pool, cfg, 'easy', words, mulberry32(7))!;
    const right = revealText(q, q.answer, 'million square kilometres', 2, words);
    const wrong = revealText(q, (1 - q.answer) as 0 | 1, 'million square kilometres', 2, words);
    expect(right.startsWith('Correct!')).toBe(true);
    expect(wrong.startsWith('Not quite.')).toBe(true);
    expect(right).toContain(q.items[q.answer].spoken);
    expect(right).toMatch(/\d+ steps (higher|lower) in pitch/);
  });
});

describe('score', () => {
  it('tracks accuracy and streaks', () => {
    let s = EMPTY_SCORE;
    for (const ok of [true, true, false, true, true, true]) s = applyAnswer(s, ok);
    expect(s).toEqual({ answered: 6, correct: 5, streak: 3, bestStreak: 3 });
    expect(scoreText(s)).toBe('5 of 6 correct, 83 percent');
    expect(scoreText(EMPTY_SCORE)).toBe('No answers yet');
  });
});
