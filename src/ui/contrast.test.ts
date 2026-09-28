import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from './contrast';

const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

/** Custom properties declared in every top-level block whose selector is exactly `selector`. */
function vars(selector: string): Record<string, string> {
  const out: Record<string, string> = {};
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const m of css.matchAll(new RegExp(`(?:^|\\n)${esc} \\{([^}]*)\\}`, 'g'))) {
    for (const v of m[1].matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,6})/g)) out[v[1]] = v[2];
  }
  return out;
}

const base = vars(':root');
const high = { ...base, ...vars(":root[data-contrast='high']") };

// [foreground, background, minimum] — 4.5 for text, 3 for large text / UI parts (focus ring, borders of controls).
const PAIRS: [string, string, number][] = [
  ['text', 'bg', 4.5],
  ['text', 'surface', 4.5],
  ['text', 'surface-2', 4.5],
  ['muted', 'bg', 4.5],
  ['muted', 'surface', 4.5],
  ['muted', 'surface-2', 4.5],
  ['ice', 'bg', 4.5],
  ['ice', 'surface', 4.5],
  ['amber', 'bg', 4.5],
  ['amber', 'surface', 4.5],
  ['neg', 'bg', 4.5],
  ['neg', 'surface', 4.5],
  ['pos', 'bg', 4.5],
  ['pos', 'surface', 4.5],
  ['voice-a', 'bg', 4.5],
  ['voice-b', 'bg', 4.5],
  ['focus', 'bg', 3],
  ['focus', 'surface-2', 3],
  ['line-strong', 'bg', 3],
];

describe.each([
  ['default theme', base],
  ['high contrast', high],
])('%s meets WCAG AA', (_name, theme) => {
  it.each(PAIRS)('%s on %s ≥ %s', (fg, bg, min) => {
    const f = theme[fg];
    expect(f, `--${fg} defined`).toBeDefined();
    expect(theme[bg], `--${bg} defined`).toBeDefined();
    expect(contrastRatio(f!, theme[bg])).toBeGreaterThanOrEqual(min);
  });
});

describe('contrastRatio', () => {
  it('black on white is 21', () => {
    expect(contrastRatio('#000', '#fff')).toBeCloseTo(21);
  });
});
