import { describe, expect, it } from 'vitest';
import { DEFAULT_ARRIVALS_LAYOUT, parseArrivalsLayout } from './arrivals-layout';

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
