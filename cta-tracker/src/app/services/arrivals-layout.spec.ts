import { describe, expect, it } from 'vitest';
import {
  COLUMN_STYLES, DEFAULT_ARRIVALS_LAYOUT, DEFAULT_COLUMN_STYLE, parseArrivalsLayout, parseColumnStyle,
  parseSwappedLines
} from './arrivals-layout';

describe('parseArrivalsLayout', () => {
  it('opts in on an exact "columns"', () => {
    expect(parseArrivalsLayout('columns')).toBe('columns');
  });

  it('keeps the list layout for a stored "list"', () => {
    expect(parseArrivalsLayout('list')).toBe('list');
  });

  it('falls back to the default when nothing is stored', () => {
    expect(parseArrivalsLayout(null)).toBe(DEFAULT_ARRIVALS_LAYOUT);
    expect(parseArrivalsLayout(undefined)).toBe(DEFAULT_ARRIVALS_LAYOUT);
    expect(parseArrivalsLayout('')).toBe(DEFAULT_ARRIVALS_LAYOUT);
  });

  it('is case-sensitive, so a mis-cased value does not opt in', () => {
    expect(parseArrivalsLayout('COLUMNS')).toBe('list');
    expect(parseArrivalsLayout('Columns')).toBe('list');
  });

  it('ignores garbage', () => {
    expect(parseArrivalsLayout('true')).toBe('list');
    expect(parseArrivalsLayout('{"layout":"columns"}')).toBe('list');
  });
});

describe('parseColumnStyle', () => {
  it('round-trips every style the picker offers', () => {
    for (const style of COLUMN_STYLES) {
      expect(parseColumnStyle(style.id)).toBe(style.id);
    }
  });

  it('offers six distinct styles', () => {
    expect(new Set(COLUMN_STYLES.map(style => style.id)).size).toBe(6);
  });

  it('falls back to the default for an unknown or missing style', () => {
    expect(parseColumnStyle(null)).toBe(DEFAULT_COLUMN_STYLE);
    expect(parseColumnStyle(undefined)).toBe(DEFAULT_COLUMN_STYLE);
    expect(parseColumnStyle('')).toBe(DEFAULT_COLUMN_STYLE);
    // A value written by a build that offered a style this one does not.
    expect(parseColumnStyle('departure-board-v2')).toBe(DEFAULT_COLUMN_STYLE);
    expect(parseColumnStyle('Split-Board')).toBe(DEFAULT_COLUMN_STYLE);
  });
});

describe('parseSwappedLines', () => {
  it('round-trips a stored array of route ids', () => {
    expect([...parseSwappedLines(JSON.stringify(['Blue', 'Red']))]).toEqual(['Blue', 'Red']);
  });

  it('swaps nothing when nothing is stored', () => {
    expect(parseSwappedLines(null).size).toBe(0);
    expect(parseSwappedLines(undefined).size).toBe(0);
    expect(parseSwappedLines('').size).toBe(0);
  });

  it('swaps nothing for a value that is not a JSON array', () => {
    expect(parseSwappedLines('Blue').size).toBe(0);
    expect(parseSwappedLines('"Blue"').size).toBe(0);
    expect(parseSwappedLines('{"Blue":true}').size).toBe(0);
    expect(parseSwappedLines('[Blue').size).toBe(0);
  });

  it('keeps only the string entries of a mixed array', () => {
    expect([...parseSwappedLines('["Blue", 1, null, {"rt":"Red"}, "G"]')]).toEqual(['Blue', 'G']);
  });
});
