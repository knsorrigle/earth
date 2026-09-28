import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { engine } from '../../audio/engine';
import { getDataset, TIMELINE_DATASETS } from '../../data/registry';
import type { Dataset } from '../../data/types';
import {
  applyAnswer,
  EMPTY_SCORE,
  makeQuestion,
  revealText,
  scoreText,
  type AskWords,
  type ClipItem,
  type Question,
  type QuestionKind,
  type Score,
} from '../../game/earTest';
import { mulberry32, pick } from '../../game/random';
import { OCEAN_REGIONS, regionMean } from '../../game/regions';
import { midiToFreq } from '../../mapping/pitch';
import { usePlayerStore, type EarDifficulty } from '../../state/playerStore';
import type { GibsFrame } from '../map/useGibsFrame';
import { noteBus } from '../../audio/noteBus';
import { colormapColor } from '../../globe/colors';
import { seriesVisual } from '../globe/visuals';

export const ROUND_LENGTH = 8;
const NOTES_PER_CLIP = 3;
const NOTE_SPACING = 0.3;
const CLIP_GAP = 0.75;
const CLIP_PAN: [number, number] = [-0.6, 0.6];

export type Phase = 'intro' | 'question' | 'revealed' | 'done';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function bestKey(d: EarDifficulty) {
  return `earth-jukebox:ear-best:${d}`;
}

/** Best round per difficulty, kept only in this browser (a per-viewer convenience). */
function loadBest(d: EarDifficulty): number | null {
  try {
    const v = window.localStorage.getItem(bestKey(d));
    return v === null ? null : Number(v);
  } catch {
    return null;
  }
}
function saveBest(d: EarDifficulty, correct: number) {
  try {
    const prev = loadBest(d);
    if (prev === null || correct > prev) window.localStorage.setItem(bestKey(d), String(correct));
  } catch {
    /* storage unavailable: best score just isn't remembered */
  }
}

/** "2026-09-01" -> "1 September 2026" (reads naturally aloud). */
function longDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** Words for a question about a dataset. */
function wordsFor(ds: Dataset, kind: QuestionKind, date: string | null): AskWords {
  const c = ds.compare ?? { subject: ds.title.toLowerCase(), higher: `means ${ds.mapping.higherMeans}`, lower: `means ${ds.mapping.lowerMeans}` };
  return kind === 'timeline'
    ? { higher: c.higher, lower: c.lower, noun: 'year', intro: `Two years of ${c.subject}.` }
    : { higher: c.higher, lower: c.lower, noun: 'region', intro: `Two ocean regions${date ? ` on ${longDate(date)}` : ''}.` };
}

/**
 * Ear Test: play two clips, the listener picks which one is "more" or
 * "less", then hears and sees the answer. Fully keyboard and screen-reader
 * driven; clip one is always on the left, clip two on the right.
 */
export function useEarTest(sst: Dataset, frame: GibsFrame) {
  const { difficulty, set } = usePlayerStore((s) => s.ear);
  const shownDate = usePlayerStore((s) => s.explore.shownDate);
  const [phase, setPhase] = useState<Phase>('intro');
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const [question, setQuestion] = useState<Question | null>(null);
  const [qNum, setQNum] = useState(0);
  const [choice, setChoice] = useState<0 | 1 | null>(null);
  const [score, setScore] = useState<Score>(EMPTY_SCORE);
  const [results, setResults] = useState<(boolean | null)[]>(() => Array(ROUND_LENGTH).fill(null));
  const [playing, setPlaying] = useState<0 | 1 | null>(null);
  const [best, setBest] = useState<number | null>(() => loadBest(difficulty));
  const rng = useRef(mulberry32((Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0));
  const recentPairs = useRef<string[]>([]);
  const timers = useRef<number[]>([]);

  useEffect(() => setBest(loadBest(difficulty)), [difficulty]);

  // Changing difficulty or question set mid-round would mix scores: start over instead.
  const settingsRef = useRef({ difficulty, set });
  useEffect(() => {
    const prev = settingsRef.current;
    settingsRef.current = { difficulty, set };
    if (prev.difficulty === difficulty && prev.set === set) return;
    if (phaseRef.current === 'question' || phaseRef.current === 'revealed') {
      usePlayerStore.getState().announce(`Settings changed, so the round was reset. Press Enter to start a new ${difficulty} round.`);
      setPhase('intro');
    }
    setScore(EMPTY_SCORE);
    setResults(Array(ROUND_LENGTH).fill(null));
    setQuestion(null);
  }, [difficulty, set]);

  // ── Pools of things to compare ──
  const timelinePools = useMemo(
    () =>
      TIMELINE_DATASETS.filter((d) => d.timeSeries && d.compare).map((d) => ({
        dataset: d,
        items: d.timeSeries!.map<ClipItem>((p) => ({ id: String(p.year), label: String(p.year), spoken: String(p.year), value: p.value, year: p.year })),
      })),
    [],
  );
  const regionPool = useMemo<ClipItem[]>(() => {
    if (!frame.grid || frame.presence) return [];
    return OCEAN_REGIONS.flatMap((r) => {
      const m = regionMean(frame.grid!, r.box);
      if (!m) return [];
      return [{ id: r.id, label: cap(r.name.replace(/^the /, '')), spoken: r.name, value: m.mean, box: r.box }];
    });
  }, [frame.grid, frame.presence]);

  const datasetOf = useCallback((q: Question) => getDataset(q.datasetId), []);
  const wordsOf = useCallback(
    (q: Question) => wordsFor(datasetOf(q), q.kind, q.kind === 'region' ? shownDate : null),
    [datasetOf, shownDate],
  );

  const newQuestion = useCallback((): Question | null => {
    const kinds: QuestionKind[] =
      set === 'timeline' ? ['timeline'] : set === 'region' ? ['region'] : ['timeline', 'region'];
    for (let attempt = 0; attempt < 30; attempt++) {
      let kind = pick(rng.current, kinds);
      if (kind === 'region' && regionPool.length < 2) kind = 'timeline';
      const q =
        kind === 'region'
          ? makeQuestion('region', sst.id, regionPool, sst.mapping, difficulty, wordsFor(sst, 'region', shownDate), rng.current)
          : (() => {
              const p = pick(rng.current, timelinePools);
              return makeQuestion('timeline', p.dataset.id, p.items, p.dataset.mapping, difficulty, wordsFor(p.dataset, 'timeline', null), rng.current);
            })();
      if (!q) continue;
      const key = `${q.datasetId}:${[q.items[0].id, q.items[1].id].sort().join('|')}`;
      if (recentPairs.current.includes(key)) continue;
      recentPairs.current = [...recentPairs.current.slice(-12), key];
      return q;
    }
    return null;
  }, [set, regionPool, sst, difficulty, shownDate, timelinePools]);

  // ── Audio ──
  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  const ensureAudio = useCallback(async () => {
    const first = !engine.ready;
    await engine.init();
    if (first) {
      const s = usePlayerStore.getState();
      engine.setMasterMuted(s.muted);
      engine.setMasterVolume(s.volumeDb);
    }
  }, []);

  /** Play clip 0, clip 1, or both in order. Velocity is fixed so loudness gives nothing away. */
  const playClips = useCallback(
    async (which: 'both' | 0 | 1 = 'both') => {
      const q = question;
      if (!q) return;
      await ensureAudio();
      clearTimers();
      const order: (0 | 1)[] = which === 'both' ? [0, 1] : [which];
      const clipLen = NOTES_PER_CLIP * NOTE_SPACING;
      order.forEach((clip, k) => {
        const start = 0.05 + k * (clipLen + CLIP_GAP);
        for (let n = 0; n < NOTES_PER_CLIP; n++) {
          engine.playClipNote(midiToFreq(q.midi[clip]), CLIP_PAN[clip], start + n * NOTE_SPACING);
        }
        timers.current.push(window.setTimeout(() => setPlaying(clip), start * 1000));
        timers.current.push(
          window.setTimeout(() => {
            setPlaying((p) => (p === clip ? null : p));
          }, (start + clipLen) * 1000),
        );
      });
      usePlayerStore
        .getState()
        .setCaption(
          which === 'both' ? '♪ clip 1 (left ear), then clip 2 (right ear)' : `♪ clip ${which + 1} (${which === 0 ? 'left' : 'right'} ear)`,
        );
    },
    [question, ensureAudio],
  );

  useEffect(
    () => () => {
      clearTimers();
      engine.setMelodyPan(0);
    },
    [],
  );

  // ── Flow ──
  const ask = useCallback(
    (n: number) => {
      const q = newQuestion();
      const s = usePlayerStore.getState();
      if (!q) {
        s.announce('Could not make a question at this difficulty. Try another question set or difficulty.');
        return;
      }
      setQuestion(q);
      setChoice(null);
      setQNum(n);
      setPhase('question');
      s.setCaption('');
      s.announce(`Question ${n} of ${ROUND_LENGTH}. ${q.prompt} Press space to listen, then left arrow for the first or right arrow for the second.`);
    },
    [newQuestion],
  );

  const start = useCallback(() => {
    setScore(EMPTY_SCORE);
    setResults(Array(ROUND_LENGTH).fill(null));
    recentPairs.current = [];
    ask(1);
  }, [ask]);

  const answer = useCallback(
    (c: 0 | 1) => {
      if (phase !== 'question' || !question) return;
      const right = c === question.answer;
      const next = applyAnswer(score, right);
      setScore(next);
      setResults((r) => r.map((v, i) => (i === qNum - 1 ? right : v)));
      setChoice(c);
      setPhase('revealed');
      clearTimers();
      setPlaying(null);
      void ensureAudio().then(() => engine.playCue(right ? 'correct' : 'wrong'));
      usePlayerStore.getState().setCaption(right ? '♪ rising two-note chime — correct' : '♪ soft falling two notes — not quite');
      // Only now, after answering, show where the answer is on the globe.
      const win = question.items[question.answer];
      if (question.kind === 'region' && win.box && frame.grid) {
        const [w, so, e, n] = win.box;
        noteBus.emit({ lat: (so + n) / 2, lon: (w + e) / 2, color: colormapColor(frame.grid.colormap, win.value), velocity: 1 });
      } else if (question.kind === 'timeline') {
        noteBus.emit(seriesVisual(datasetOf(question), win.value, 1));
      }
      const ds = datasetOf(question);
      const last = qNum >= ROUND_LENGTH;
      usePlayerStore
        .getState()
        .announce(
          `${revealText(question, c, ds.unitSpoken, ds.decimals, wordsOf(question))} ` +
            `Score: ${scoreText(next)}. ${last ? 'Press Enter to see your results.' : 'Press Enter for the next question.'}`,
        );
    },
    [phase, question, score, qNum, ensureAudio, datasetOf, wordsOf, frame.grid],
  );

  const next = useCallback(() => {
    if (phase === 'intro' || phase === 'done') return start();
    if (phase !== 'revealed') return;
    if (qNum >= ROUND_LENGTH) {
      setPhase('done');
      saveBest(difficulty, score.correct);
      const prevBest = best;
      setBest(loadBest(difficulty));
      usePlayerStore
        .getState()
        .announce(
          `Round complete. ${scoreText(score)}. Best streak ${score.bestStreak}. ` +
            (prevBest === null || score.correct > prevBest ? `A new best on ${difficulty}! ` : `Your best on ${difficulty} is ${prevBest} of ${ROUND_LENGTH}. `) +
            'Press Enter to play again.',
        );
      return;
    }
    ask(qNum + 1);
  }, [phase, qNum, start, ask, difficulty, score, best]);

  const repeatPrompt = useCallback(() => {
    const s = usePlayerStore.getState();
    if (phase === 'question' && question) s.announce(`Question ${qNum} of ${ROUND_LENGTH}. ${question.prompt}`);
    else if (phase === 'revealed' && question && choice !== null) {
      const ds = datasetOf(question);
      s.announce(revealText(question, choice, ds.unitSpoken, ds.decimals, wordsOf(question)));
    } else if (phase === 'done') s.announce(`Round complete. ${scoreText(score)}.`);
    else s.announce('Ear Test. Press Enter to start.');
  }, [phase, question, qNum, choice, score, datasetOf, wordsOf]);

  const speakScore = useCallback(
    () => usePlayerStore.getState().announce(`${scoreText(score)}. Current streak ${score.streak}.`),
    [score],
  );

  const howItWorks = useMemo(
    () => [
      `You hear two short clips: the first in your left ear, the second in your right.`,
      `Each clip is one value played as three notes. Higher pitch means more — more ice, warmer water, more carbon dioxide.`,
      `Answer with the left arrow for the first clip or the right arrow for the second. Space plays the clips again.`,
      `After you answer you hear whether you were right, with the real numbers. ${ROUND_LENGTH} questions per round.`,
    ],
    [],
  );

  const speakHelp = useCallback(() => usePlayerStore.getState().announce(`Ear Test. ${howItWorks.join(' ')}`), [howItWorks]);

  return {
    phase,
    question,
    qNum,
    choice,
    score,
    results,
    best,
    playing,
    regionCount: regionPool.length,
    howItWorks,
    datasetOf,
    wordsOf,
    start,
    answer,
    next,
    playClips,
    repeatPrompt,
    speakScore,
    speakHelp,
  };
}

export type EarTestApi = ReturnType<typeof useEarTest>;
