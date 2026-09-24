import { describe, expect, it } from 'vitest';
import {
  DOT, GLYPH_H, GLYPH_W, LedColumn, MARK_FILLED, MARK_HOLLOW, SIGN_MARGIN, glyphFor, liftLightness, layoutSign,
  maxChars, measure, parseColor, rasterize, wrapText
} from './led-matrix';

const train = (countdown: string, destination = 'Howard', delayed = false, scheduled = false) =>
  ({ destination, countdown, delayed, scheduled });
const column = (label: string, trains = [train('4')], filled = true): LedColumn => ({ label, filled, trains });

describe('the 5×7 font', () => {
  it('draws every glyph on a 5×7 grid', () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 /&-.,\':' + MARK_FILLED + MARK_HOLLOW;
    for (const char of chars) {
      const glyph = glyphFor(char);
      expect(glyph.length, char).toBe(GLYPH_H);
      for (const row of glyph) {
        expect(row.length, char).toBe(GLYPH_W);
      }
    }
  });

  it('sets lowercase in capitals and leaves unknown characters blank', () => {
    expect(glyphFor('a')).toEqual(glyphFor('A'));
    expect(glyphFor('é').join('').trim()).toBe('');
  });
});

describe('measure and maxChars', () => {
  it('counts five dots per character and one between', () => {
    expect(measure('A')).toBe(5);
    expect(measure('AB')).toBe(11);
    expect(measure('')).toBe(0);
  });

  it('doubles everything at scale 2', () => {
    expect(measure('12', 2)).toBe(22);
  });

  it('is the inverse of measure', () => {
    expect(maxChars(measure('HOWARD'))).toBe(6);
    expect(maxChars(measure('HOWARD') - 1)).toBe(5);
    expect(maxChars(measure('12', 2), 2)).toBe(2);
  });
});

describe('wrapText', () => {
  it('fits words greedily', () => {
    expect(wrapText('COTTAGE GROVE', 13)).toEqual(['COTTAGE GROVE']);
    expect(wrapText('COTTAGE GROVE', 10)).toEqual(['COTTAGE', 'GROVE']);
  });

  it('breaks a long word after a slash or a hyphen before cutting it', () => {
    expect(wrapText('ASHLAND/63RD & COTTAGE GROVE', 13)).toEqual(['ASHLAND/63RD', '& COTTAGE', 'GROVE']);
    expect(wrapText('DEMPSTER-SKOKIE', 10)).toEqual(['DEMPSTER-', 'SKOKIE']);
  });

  it('cuts a word with nowhere to break', () => {
    expect(wrapText('ABCDEFGHIJ', 4)).toEqual(['ABCD', 'EFGH', 'IJ']);
  });

  it('gives nothing for no room or no text', () => {
    expect(wrapText('HOWARD', 0)).toEqual([]);
    expect(wrapText('   ', 10)).toEqual([]);
  });
});

describe('layoutSign', () => {
  it('starts both columns\' trains on the same row, below the taller header', () => {
    const sign = layoutSign([column('HOWARD'), column('ASHLAND/63RD & COTTAGE GROVE')], 180);
    const [left, right] = [0, 1].map(i => sign.blocks.find(block => block.column === i)!);
    expect(left.y).toBe(right.y);
  });

  it('keeps every run inside the margins', () => {
    const sign = layoutSign([column('HOWARD', [train('DUE'), train('4', 'Howard', true), train('19', 'Howard', false, true)]),
      column('95TH/DAN RYAN', [train('2', '95th/Dan Ryan')])], 180);
    for (const run of sign.runs) {
      expect(run.x).toBeGreaterThanOrEqual(SIGN_MARGIN);
      expect(run.x + measure(run.text, run.scale)).toBeLessThanOrEqual(sign.cols - SIGN_MARGIN);
    }
  });

  it('gives one tap block per train', () => {
    const sign = layoutSign([column('HOWARD', [train('1'), train('2')]), column('95TH', [train('3')])], 180);
    expect(sign.blocks.map(block => [block.column, block.trainIndex])).toEqual([[0, 0], [0, 1], [1, 0]]);
  });

  it('blinks only a due figure', () => {
    const sign = layoutSign([column('LOOP', [train('DUE', 'Loop'), train('6', 'Loop')])], 180);
    expect(sign.runs.filter(run => run.blink).map(run => run.text)).toEqual(['DUE']);
  });

  it('marks the directions filled and hollow', () => {
    const sign = layoutSign([column('A'), { ...column('B'), filled: false }], 180);
    expect(sign.runs.filter(run => run.text === MARK_FILLED || run.text === MARK_HOLLOW).map(run => run.text))
      .toEqual([MARK_FILLED, MARK_HOLLOW]);
  });

  it('tags a delayed train in white and dims a scheduled one', () => {
    const sign = layoutSign([column('HOWARD', [train('4', 'Howard', true), train('19', 'Howard', false, true)])], 180);
    expect(sign.runs.find(run => run.text === 'DLY')?.tone).toBe('white');
    expect(sign.runs.filter(run => run.text === '19' || run.text === 'SCH').map(run => run.tone)).toEqual(['dim', 'dim']);
  });

  it('spans the whole width at one direction, with no divider between columns', () => {
    const sign = layoutSign([column('LOOP')], 180);
    expect(sign.rules.some(rule => rule.vertical)).toBe(false);
    expect(sign.blocks[0].w).toBe(180 - SIGN_MARGIN * 2);
  });

  it('keeps an empty sign at least minRows tall', () => {
    expect(layoutSign([], 180, 60).rows).toBe(60);
  });
});

describe('rasterize', () => {
  it('lights exactly the glyph\'s dots, on the grid', () => {
    const sign = { cols: 7, rows: 9, rules: [], blocks: [],
      runs: [{ column: 0, x: 1, y: 1, text: 'I', scale: 1 as const, tone: 'lit' as const, blink: false }] };
    const { dots } = rasterize(sign);
    const rows = Array.from({ length: 9 }, (_, y) =>
      Array.from({ length: 7 }, (_, x) => dots[y * 7 + x] === DOT.lit ? '#' : ' ').join(''));
    expect(rows).toEqual(['       ', '  ###  ', '   #   ', '   #   ', '   #   ', '   #   ', '   #   ', '  ###  ', '       ']);
  });

  it('draws a scale-2 pixel as a 2×2 block of grid dots', () => {
    const sign = { cols: 12, rows: 16, rules: [], blocks: [],
      runs: [{ column: 0, x: 0, y: 0, text: '-', scale: 2 as const, tone: 'lit' as const, blink: false }] };
    const { dots } = rasterize(sign);
    const lit = [...dots.keys()].filter(i => dots[i] === DOT.lit);
    // '-' is one row of five pixels: ten dots wide, two dots tall.
    expect(lit.length).toBe(20);
    expect(new Set(lit.map(i => Math.floor(i / 12)))).toEqual(new Set([6, 7]));
  });

  it('leaves a blinking run dark on the off beat', () => {
    const sign = layoutSign([column('LOOP', [train('DUE', 'Loop')])], 120);
    const on = rasterize(sign, true).dots.filter(dot => dot === DOT.lit).length;
    const off = rasterize(sign, false).dots.filter(dot => dot === DOT.lit).length;
    expect(off).toBeLessThan(on);
  });

  it('drops anything past the edge instead of wrapping it', () => {
    const sign = { cols: 3, rows: 3, rules: [], blocks: [],
      runs: [{ column: 0, x: 0, y: 0, text: 'W', scale: 1 as const, tone: 'lit' as const, blink: false }] };
    expect(rasterize(sign).dots.length).toBe(9);
  });
});

describe('colour', () => {
  it('parses the forms getComputedStyle returns', () => {
    expect(parseColor('rgb(198, 12, 48)')).toEqual([198, 12, 48]);
    expect(parseColor('rgba(0,161,222,0.5)')).toEqual([0, 161, 222]);
    expect(parseColor(' #62361b ')).toEqual([98, 54, 27]);
    expect(parseColor('var(--cta-red)')).toBeNull();
  });

  it('leaves a colour already light enough alone', () => {
    expect(liftLightness([249, 70, 28], 0.5)).toEqual([249, 70, 28]);
  });

  it('lifts a dark line to the floor without changing its hue', () => {
    const lifted = liftLightness([98, 54, 27], 0.55);
    const lightness = (Math.max(...lifted) + Math.min(...lifted)) / 2 / 255;
    expect(lightness).toBeCloseTo(0.55, 1);
    // Still brown: red channel highest, blue lowest.
    expect(lifted[0]).toBeGreaterThan(lifted[1]);
    expect(lifted[1]).toBeGreaterThan(lifted[2]);
  });

  it('keeps red red rather than washing it to pink', () => {
    const [r, g, b] = liftLightness([198, 12, 48], 0.55);
    expect(r).toBeGreaterThan(230);
    expect(g).toBeLessThan(80);
    expect(b).toBeLessThan(110);
  });

  it('lifts a grey to a lighter grey', () => {
    expect(liftLightness([40, 40, 40], 0.5)).toEqual([128, 128, 128]);
  });
});
