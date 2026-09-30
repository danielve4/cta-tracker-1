import { describe, expect, it } from 'vitest';
import {
  ARRIVALS_LAYOUTS, COLUMN_STYLES, DEFAULT_ARRIVALS_LAYOUT, DEFAULT_COLUMN_STYLE, DEFAULT_DEPTH_STYLE, DEPTH_STYLES,
  isSideBySide, parseArrivalsLayout, parseColumnStyle, parseDepthStyle, parseSwappedLines
} from './arrivals-layout';

describe('parseArrivalsLayout', () => {
  it('round-trips every layout the picker offers', () => {
    for (const layout of ARRIVALS_LAYOUTS) {
      expect(parseArrivalsLayout(layout.id)).toBe(layout.id);
    }
  });

  it('offers the list, columns, approach and 3D layouts', () => {
    expect(ARRIVALS_LAYOUTS.map(layout => layout.id)).toEqual(['list', 'columns', 'approach', 'depth']);
  });

  it('falls back to the default when nothing is stored', () => {
    expect(parseArrivalsLayout(null)).toBe(DEFAULT_ARRIVALS_LAYOUT);
    expect(parseArrivalsLayout(undefined)).toBe(DEFAULT_ARRIVALS_LAYOUT);
    expect(parseArrivalsLayout('')).toBe(DEFAULT_ARRIVALS_LAYOUT);
  });

  it('is case-sensitive, so a mis-cased value does not opt in', () => {
    expect(parseArrivalsLayout('COLUMNS')).toBe('list');
    expect(parseArrivalsLayout('Approach')).toBe('list');
  });

  it('ignores garbage', () => {
    expect(parseArrivalsLayout('true')).toBe('list');
    expect(parseArrivalsLayout('{"layout":"columns"}')).toBe('list');
  });
});

describe('isSideBySide', () => {
  it('fixes each direction to a side everywhere but the list', () => {
    expect(isSideBySide('list')).toBe(false);
    expect(isSideBySide('columns')).toBe(true);
    expect(isSideBySide('approach')).toBe(true);
    expect(isSideBySide('depth')).toBe(true);
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

  it('defaults to a style the picker offers', () => {
    expect(COLUMN_STYLES.some(style => style.id === DEFAULT_COLUMN_STYLE)).toBe(true);
  });

  it('sends a style from an earlier build to the default', () => {
    for (const retired of ['split-board', 'mirror-timeline', 'departure-board', 'next-up', 'spine-rails', 'inverted-cards', 'sentence']) {
      expect(parseColumnStyle(retired)).toBe(DEFAULT_COLUMN_STYLE);
    }
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

describe('parseDepthStyle', () => {
  it('round-trips every style the picker offers', () => {
    for (const style of DEPTH_STYLES) {
      expect(parseDepthStyle(style.id)).toBe(style.id);
    }
  });

  it('offers the six 3D styles, Tunnel first', () => {
    expect(DEPTH_STYLES.map(style => style.id))
      .toEqual(['tunnel', 'diorama', 'cover-flow', 'time-stack', 'neon-skyline', 'holo-card']);
    expect(DEFAULT_DEPTH_STYLE).toBe('tunnel');
  });

  it('falls back to the default for nothing, garbage, or a column style', () => {
    expect(parseDepthStyle(null)).toBe(DEFAULT_DEPTH_STYLE);
    expect(parseDepthStyle('')).toBe(DEFAULT_DEPTH_STYLE);
    expect(parseDepthStyle('Tunnel')).toBe(DEFAULT_DEPTH_STYLE);
    expect(parseDepthStyle('platform-led')).toBe(DEFAULT_DEPTH_STYLE);
  });
});
