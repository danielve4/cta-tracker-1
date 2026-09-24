/**
 * The Platform LED style's sign, laid out and rasterised on a single grid of dots.
 *
 * A web font cannot be made to line up with a dot-grid background — its glyph dots land wherever
 * its metrics put them, so up close the lit dots sit between the unlit ones and the illusion
 * breaks. Here the text is set in a 5×7 bitmap font, the way a real platform sign is, and every
 * lit dot is one cell of the same grid the unlit dots are drawn from.
 *
 * Angular-free, so the layout and rasterising are unit-tested; the component only paints cells.
 */

export const GLYPH_W = 5;
export const GLYPH_H = 7;
/** One blank column between characters. */
const ADVANCE = GLYPH_W + 1;

/** Filled and hollow squares mark the two directions, as the other column styles do. */
export const MARK_FILLED = '■';
export const MARK_HOLLOW = '□';

const BLANK = ['     ', '     ', '     ', '     ', '     ', '     ', '     '];

/** Uppercase, digits, and the punctuation CTA destination names use. Rows top to bottom, `#` lit. */
const FONT: Record<string, string[]> = {
  'A': [' ### ', '#   #', '#   #', '#####', '#   #', '#   #', '#   #'],
  'B': ['#### ', '#   #', '#   #', '#### ', '#   #', '#   #', '#### '],
  'C': [' ### ', '#   #', '#    ', '#    ', '#    ', '#   #', ' ### '],
  'D': ['#### ', '#   #', '#   #', '#   #', '#   #', '#   #', '#### '],
  'E': ['#####', '#    ', '#    ', '#### ', '#    ', '#    ', '#####'],
  'F': ['#####', '#    ', '#    ', '#### ', '#    ', '#    ', '#    '],
  'G': [' ### ', '#   #', '#    ', '# ###', '#   #', '#   #', ' ####'],
  'H': ['#   #', '#   #', '#   #', '#####', '#   #', '#   #', '#   #'],
  'I': [' ### ', '  #  ', '  #  ', '  #  ', '  #  ', '  #  ', ' ### '],
  'J': ['  ###', '   # ', '   # ', '   # ', '   # ', '#  # ', ' ##  '],
  'K': ['#   #', '#  # ', '# #  ', '##   ', '# #  ', '#  # ', '#   #'],
  'L': ['#    ', '#    ', '#    ', '#    ', '#    ', '#    ', '#####'],
  'M': ['#   #', '## ##', '# # #', '# # #', '#   #', '#   #', '#   #'],
  'N': ['#   #', '#   #', '##  #', '# # #', '#  ##', '#   #', '#   #'],
  'O': [' ### ', '#   #', '#   #', '#   #', '#   #', '#   #', ' ### '],
  'P': ['#### ', '#   #', '#   #', '#### ', '#    ', '#    ', '#    '],
  'Q': [' ### ', '#   #', '#   #', '#   #', '# # #', '#  # ', ' ## #'],
  'R': ['#### ', '#   #', '#   #', '#### ', '# #  ', '#  # ', '#   #'],
  'S': [' ####', '#    ', '#    ', ' ### ', '    #', '    #', '#### '],
  'T': ['#####', '  #  ', '  #  ', '  #  ', '  #  ', '  #  ', '  #  '],
  'U': ['#   #', '#   #', '#   #', '#   #', '#   #', '#   #', ' ### '],
  'V': ['#   #', '#   #', '#   #', '#   #', '#   #', ' # # ', '  #  '],
  'W': ['#   #', '#   #', '#   #', '# # #', '# # #', '# # #', ' # # '],
  'X': ['#   #', '#   #', ' # # ', '  #  ', ' # # ', '#   #', '#   #'],
  'Y': ['#   #', '#   #', ' # # ', '  #  ', '  #  ', '  #  ', '  #  '],
  'Z': ['#####', '    #', '   # ', '  #  ', ' #   ', '#    ', '#####'],
  '0': [' ### ', '#   #', '#  ##', '# # #', '##  #', '#   #', ' ### '],
  '1': ['  #  ', ' ##  ', '  #  ', '  #  ', '  #  ', '  #  ', ' ### '],
  '2': [' ### ', '#   #', '    #', '   # ', '  #  ', ' #   ', '#####'],
  '3': ['#####', '   # ', '  #  ', '   # ', '    #', '#   #', ' ### '],
  '4': ['   # ', '  ## ', ' # # ', '#  # ', '#####', '   # ', '   # '],
  '5': ['#####', '#    ', '#### ', '    #', '    #', '#   #', ' ### '],
  '6': ['  ## ', ' #   ', '#    ', '#### ', '#   #', '#   #', ' ### '],
  '7': ['#####', '    #', '   # ', '  #  ', ' #   ', ' #   ', ' #   '],
  '8': [' ### ', '#   #', '#   #', ' ### ', '#   #', '#   #', ' ### '],
  '9': [' ### ', '#   #', '#   #', ' ####', '    #', '   # ', ' ##  '],
  ' ': BLANK,
  '/': ['    #', '    #', '   # ', '  #  ', ' #   ', '#    ', '#    '],
  '&': [' ##  ', '#  # ', '# #  ', ' #   ', '# # #', '#  # ', ' ## #'],
  '-': ['     ', '     ', '     ', '#####', '     ', '     ', '     '],
  '.': ['     ', '     ', '     ', '     ', '     ', ' ##  ', ' ##  '],
  ',': ['     ', '     ', '     ', '     ', ' ##  ', '  #  ', ' #   '],
  '\'': ['  #  ', '  #  ', ' #   ', '     ', '     ', '     ', '     '],
  ':': ['     ', ' ##  ', ' ##  ', '     ', ' ##  ', ' ##  ', '     '],
  [MARK_FILLED]: ['     ', '#####', '#####', '#####', '#####', '#####', '     '],
  [MARK_HOLLOW]: ['     ', '#####', '#   #', '#   #', '#   #', '#####', '     ']
};

/** The glyph for a character: lowercase is set in capitals, anything without a shape is blank. */
export function glyphFor(char: string): string[] {
  return FONT[char] ?? FONT[char.toUpperCase()] ?? BLANK;
}

/** Width in dots of `text` at `scale`, where each font pixel is a `scale × scale` block of dots. */
export function measure(text: string, scale = 1): number {
  return text.length === 0 ? 0 : (text.length * ADVANCE - 1) * scale;
}

/** How many characters fit in `width` dots at `scale`. */
export function maxChars(width: number, scale = 1): number {
  return Math.max(0, Math.floor((width + scale) / (ADVANCE * scale)));
}

/**
 * Word-wraps `text` to lines of at most `limit` characters. A word too long for a line breaks
 * after a `/` or `-` if it has one ("ASHLAND/" "63RD"), and is cut hard only as a last resort.
 */
export function wrapText(text: string, limit: number): string[] {
  if (limit <= 0) {
    return [];
  }
  const pieces: Array<{ text: string; glued: boolean }> = [];
  for (const word of text.trim().split(/\s+/).filter(Boolean)) {
    const parts = word.length > limit ? word.split(/(?<=[/-])/) : [word];
    parts.forEach((part, i) => {
      for (let start = 0; start < part.length; start += limit) {
        pieces.push({ text: part.slice(start, start + limit), glued: i > 0 || start > 0 });
      }
    });
  }
  const lines: string[] = [];
  let line = '';
  for (const piece of pieces) {
    const joined = line === '' ? piece.text : line + (piece.glued ? '' : ' ') + piece.text;
    if (joined.length <= limit) {
      line = joined;
    } else {
      lines.push(line);
      line = piece.text;
    }
  }
  if (line) {
    lines.push(line);
  }
  return lines;
}

// ── Layout ──

/** How a run is lit. `blink` runs go dark on the off beat of the due-train flash. */
export type LedTone = 'lit' | 'dim' | 'white';

export interface LedRun {
  column: number;
  x: number;
  y: number;
  text: string;
  scale: 1 | 2;
  tone: LedTone;
  blink: boolean;
}

/** A train's tap target, in dots. */
export interface LedBlock {
  column: number;
  trainIndex: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LedTrain {
  destination: string;
  /** `'DUE'`, a minute count, or `'--'`, as the arrivals screen derives it. */
  countdown: string;
  delayed: boolean;
  scheduled: boolean;
}

export interface LedColumn {
  label: string;
  filled: boolean;
  trains: LedTrain[];
}

export interface LedSign {
  cols: number;
  rows: number;
  runs: LedRun[];
  blocks: LedBlock[];
  /** Dotted rules: under each header, and between the two columns. */
  rules: Array<{ x: number; y: number; length: number; vertical: boolean }>;
}

/** The border of unlit dots around the text, and the gap between the two columns. */
export const SIGN_MARGIN = 8;
const GUTTER = 7;
const LINE = GLYPH_H + 2;

/**
 * Lays the sign out in dot units for a panel `cols` dots wide. Both columns' trains start on the
 * same row, below the taller of the two headers, so the first trains line up across the sign.
 * `minRows` keeps an empty or loading sign from collapsing.
 */
export function layoutSign(columns: LedColumn[], cols: number, minRows = 0): LedSign {
  const runs: LedRun[] = [];
  const blocks: LedBlock[] = [];
  const rules: LedSign['rules'] = [];
  const count = Math.min(columns.length, 2);
  const inner = cols - SIGN_MARGIN * 2;
  const colW = count === 2 ? Math.floor((inner - GUTTER) / 2) : inner;
  const xOf = (index: number) => SIGN_MARGIN + index * (colW + GUTTER);

  const run = (column: number, x: number, y: number, text: string, scale: 1 | 2, tone: LedTone, blink = false) =>
    runs.push({ column, x, y, text, scale, tone, blink });

  // Headers first, so the trains can start below the taller one.
  let headerEnd = SIGN_MARGIN;
  columns.slice(0, count).forEach((column, index) => {
    const x = xOf(index);
    run(index, x, SIGN_MARGIN, column.filled ? MARK_FILLED : MARK_HOLLOW, 1, 'lit');
    const lines = wrapText(column.label, maxChars(colW - ADVANCE - 1));
    lines.forEach((text, i) => run(index, x + ADVANCE + 1, SIGN_MARGIN + i * LINE, text, 1, 'lit'));
    headerEnd = Math.max(headerEnd, SIGN_MARGIN + Math.max(lines.length, 1) * LINE);
  });
  columns.slice(0, count).forEach((_, index) =>
    rules.push({ x: xOf(index), y: headerEnd, length: colW, vertical: false }));

  let bottom = headerEnd + 1;
  columns.slice(0, count).forEach((column, index) => {
    const x = xOf(index);
    let y = headerEnd + 6;
    column.trains.forEach((train, trainIndex) => {
      const top = y;
      const tone: LedTone = train.scheduled ? 'dim' : 'lit';
      const destination = wrapText(train.destination, maxChars(colW)).slice(0, 2);
      destination.forEach(text => {
        run(index, x, y, text, 1, tone);
        y += LINE;
      });
      y += 1;
      const due = train.countdown === 'DUE';
      const figure = due ? 'DUE' : train.countdown;
      run(index, x, y, figure, 2, tone, due);
      let after = x + measure(figure, 2);
      if (!due) {
        // "MIN" sits on the same baseline as the big figure.
        run(index, after + 4, y + GLYPH_H, 'MIN', 1, tone);
        after += 4 + measure('MIN');
      }
      const tag = train.delayed ? 'DLY' : train.scheduled ? 'SCH' : '';
      if (tag) {
        const fits = after + 5 + measure(tag) <= x + colW;
        run(index, fits ? after + 5 : x, fits ? y + GLYPH_H : y + GLYPH_H * 2 + 2, tag, 1, train.delayed ? 'white' : 'dim');
        if (!fits) {
          y += LINE;
        }
      }
      y += GLYPH_H * 2;
      blocks.push({ column: index, trainIndex, x, y: top - 3, w: colW, h: y - top + 6 });
      y += 7;
    });
    bottom = Math.max(bottom, y);
  });

  const rows = Math.max(bottom + SIGN_MARGIN - 7, minRows);
  if (count === 2) {
    rules.push({ x: xOf(1) - Math.ceil(GUTTER / 2), y: SIGN_MARGIN, length: rows - SIGN_MARGIN * 2, vertical: true });
  }
  return { cols, rows, runs, blocks, rules };
}

// ── Rasterising ──

/** Per-dot codes in a rasterised sign. */
export const DOT = { off: 0, lit: 1, dim: 2, white: 3, rule: 4 } as const;

export interface LedRaster {
  cols: number;
  rows: number;
  /** `DOT` code per cell, row-major. */
  dots: Uint8Array;
  /** Which column (direction) lit each cell, for its colour. */
  column: Uint8Array;
}

/**
 * Every cell of the sign, lit or not. `blinkOn` false leaves blinking runs dark, which is how a
 * due train flashes. Anything that would land off the grid is dropped.
 */
export function rasterize(sign: LedSign, blinkOn = true): LedRaster {
  const { cols, rows } = sign;
  const dots = new Uint8Array(cols * rows);
  const column = new Uint8Array(cols * rows);
  const set = (x: number, y: number, code: number, col: number) => {
    if (x >= 0 && y >= 0 && x < cols && y < rows) {
      dots[y * cols + x] = code;
      column[y * cols + x] = col;
    }
  };

  for (const rule of sign.rules) {
    for (let i = 0; i < rule.length; i += 2) {
      set(rule.vertical ? rule.x : rule.x + i, rule.vertical ? rule.y + i : rule.y, DOT.rule, 0);
    }
  }
  for (const run of sign.runs) {
    if (run.blink && !blinkOn) {
      continue;
    }
    const code = DOT[run.tone];
    [...run.text].forEach((char, i) => {
      const glyph = glyphFor(char);
      const left = run.x + i * ADVANCE * run.scale;
      for (let gy = 0; gy < GLYPH_H; gy++) {
        for (let gx = 0; gx < GLYPH_W; gx++) {
          if (glyph[gy][gx] !== '#') {
            continue;
          }
          for (let sy = 0; sy < run.scale; sy++) {
            for (let sx = 0; sx < run.scale; sx++) {
              set(left + gx * run.scale + sx, run.y + gy * run.scale + sy, code, run.column);
            }
          }
        }
      }
    });
  }
  return { cols, rows, dots, column };
}

// ── Colour ──

/** `rgb(198, 12, 48)` or `#c60c30` → [198, 12, 48]; null for anything else. */
export function parseColor(value: string): [number, number, number] | null {
  const text = value.trim();
  const rgb = text.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i);
  if (rgb) {
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  }
  const hex = text.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  return null;
}

/**
 * The colour a lit dot shows: the line's own hue and saturation, with its lightness raised to at
 * least `minLightness` (0–1) so the dark lines — Brown, Purple, Red — glow on the black face rather
 * than sinking into it. Mixing in white instead washed Red out to pink.
 */
export function liftLightness([r, g, b]: [number, number, number], minLightness: number): [number, number, number] {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const lightness = (max + min) / 2;
  if (lightness >= minLightness) {
    return [r, g, b];
  }
  const delta = max - min;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  const hue = delta === 0 ? 0
    : max === rn ? ((gn - bn) / delta) % 6
    : max === gn ? (bn - rn) / delta + 2
    : (rn - gn) / delta + 4;
  const chroma = (1 - Math.abs(2 * minLightness - 1)) * saturation;
  const x = chroma * (1 - Math.abs((hue % 2 + 2) % 2 - 1));
  const m = minLightness - chroma / 2;
  const sector = Math.floor(((hue % 6) + 6) % 6);
  const [r1, g1, b1] = [[chroma, x, 0], [x, chroma, 0], [0, chroma, x], [0, x, chroma], [x, 0, chroma], [chroma, 0, x]][sector];
  return [Math.round((r1 + m) * 255), Math.round((g1 + m) * 255), Math.round((b1 + m) * 255)];
}
