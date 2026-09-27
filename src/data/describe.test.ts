import { describe, expect, it } from 'vitest';
import { describeSeries } from './describe';

describe('describeSeries', () => {
  it('summarises start, end, extremes and change', () => {
    const text = describeSeries(
      [
        { year: 2000, value: 10 },
        { year: 2001, value: 4 },
        { year: 2002, value: 8 },
      ],
      'test values',
      'units',
      1,
    );
    expect(text).toContain('2000 to 2002');
    expect(text).toContain('fell by 2.0 (20 percent)');
    expect(text).toContain('Highest: 10.0 in 2000');
    expect(text).toContain('Lowest: 4.0 in 2001');
  });

  it('omits percent for anomalies', () => {
    const text = describeSeries([{ year: 1, value: -0.2 }, { year: 2, value: 1.2 }], 'x', 'u', 1, { percent: false });
    expect(text).toContain('rose by 1.4.');
    expect(text).not.toContain('percent');
  });

  it('handles empty series', () => {
    expect(describeSeries([], 'x', 'u', 0)).toBe('No data for x.');
  });
});
