import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, afterRenderEffect, computed, inject,
  signal, viewChild
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { placeName } from '../arrival-visuals';
import { DOT, LedSign, layoutSign, liftLightness, parseColor, rasterize } from '../led-matrix';
import { ArrivalGroup, TrainArrivalDisplay } from '../train-arrival-groups';
import { ColumnVariantBase } from './column-variant.base';

/** CSS pixels from one dot's centre to the next. 13 characters fit a 375px phone's column. */
const PITCH = 2;
/** The panel runs edge to edge, breaking out of the page's 16px padding on both sides. */
const BLEED = 16;
/** Rows an empty or loading sign keeps, so it does not collapse to a sliver. */
const MIN_ROWS = 60;
const BLINK_MS = 600;
const FALLBACK_RGB: [number, number, number] = [255, 176, 46];

interface Tap {
  key: string;
  group: ArrivalGroup;
  arrival: TrainArrivalDisplay;
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * A platform arrival sign, drawn as a real dot matrix: one grid of dots on a canvas, lit in the
 * line's colour, with the text set in a 5×7 bitmap font so every lit dot is one of the grid's.
 * The panel stays dark in both themes, because it is a sign, not a surface.
 *
 * The canvas is decoration: each train is a transparent link laid over its block, carrying the
 * accessible label and the route to that train.
 */
@Component({
  selector: 'app-platform-led',
  templateUrl: './platform-led.component.html',
  styleUrls: ['./columns-shared.css', './platform-led.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink]
})
export class PlatformLedComponent extends ColumnVariantBase {
  readonly pitch = PITCH;

  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  /** The panel's width in CSS pixels; 0 until measured, which never happens during prerendering. */
  private readonly panelWidth = signal(0);
  private readonly blinkOn = signal(true);

  readonly sign = computed<LedSign | null>(() => {
    const cols = Math.floor(this.panelWidth() / PITCH);
    if (!cols) {
      return null;
    }
    const groups = this.loading() ? [] : (this.groups() ?? []);
    return layoutSign(groups.slice(0, 2).map((group, index) => ({
      label: placeName(group.directionLabel),
      filled: this.variantFor(index) === 'fill',
      trains: group.arrivals.map(arrival => ({
        destination: arrival.destNm,
        countdown: arrival.countdown,
        delayed: arrival.isDly === '1',
        scheduled: arrival.isSch === '1'
      }))
    })), cols, MIN_ROWS);
  });

  readonly taps = computed<Tap[]>(() => {
    const sign = this.sign();
    const groups = this.groups() ?? [];
    if (!sign || this.loading()) {
      return [];
    }
    return sign.blocks.flatMap(block => {
      const group = groups[block.column];
      const arrival = group?.arrivals[block.trainIndex];
      return group && arrival ? [{
        key: arrival.rn + arrival.stpId,
        group,
        arrival,
        left: block.x * PITCH,
        top: block.y * PITCH,
        width: block.w * PITCH,
        height: block.h * PITCH
      }] : [];
    });
  });

  private readonly hasBlink = computed(() => this.sign()?.runs.some(run => run.blink) ?? false);

  constructor() {
    super();
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      const observer = new ResizeObserver(() => this.panelWidth.set(host.clientWidth + BLEED * 2));
      observer.observe(host);
      // A due train flashes, as it does on the real sign — unless the rider has asked for less motion.
      const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const timer = still ? undefined : setInterval(() => {
        if (this.hasBlink()) {
          this.blinkOn.update(on => !on);
        } else if (!this.blinkOn()) {
          this.blinkOn.set(true);
        }
      }, BLINK_MS);
      destroyRef.onDestroy(() => {
        observer.disconnect();
        clearInterval(timer);
      });
    });

    afterRenderEffect(() => {
      const canvas = this.canvas()?.nativeElement;
      const sign = this.sign();
      const blinkOn = this.blinkOn();
      if (canvas && sign) {
        this.draw(canvas, sign, blinkOn);
      }
    });
  }

  /** The line colour's RGB, read from the CSS custom property the arrival carries (`var(--cta-red)`). */
  private lineRgb(): [number, number, number] {
    const group = (this.groups() ?? [])[0];
    const color = group ? this.colorFor(group) : '';
    const name = color.match(/var\((--[\w-]+)\)/)?.[1];
    const value = name ? getComputedStyle(document.documentElement).getPropertyValue(name) : color;
    return parseColor(value) ?? FALLBACK_RGB;
  }

  private draw(canvas: HTMLCanvasElement, sign: LedSign, blinkOn: boolean): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    const dpr = window.devicePixelRatio || 1;
    const width = sign.cols * PITCH;
    const height = sign.rows * PITCH;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#070605';
    ctx.fillRect(0, 0, width, height);

    const [r, g, b] = liftLightness(this.lineRgb(), 0.55);
    const rgba = (alpha: number) => `rgba(${r}, ${g}, ${b}, ${alpha})`;
    // One path per kind of dot, filled once: tens of thousands of dots, a handful of fills.
    const paths = new Map<number, Path2D>();
    const radius = PITCH * 0.42;
    const raster = rasterize(sign, blinkOn);
    for (let y = 0; y < raster.rows; y++) {
      for (let x = 0; x < raster.cols; x++) {
        const code = raster.dots[y * raster.cols + x];
        let path = paths.get(code);
        if (!path) {
          path = new Path2D();
          paths.set(code, path);
        }
        const cx = x * PITCH + PITCH / 2;
        const cy = y * PITCH + PITCH / 2;
        path.moveTo(cx + radius, cy);
        path.arc(cx, cy, radius, 0, Math.PI * 2);
      }
    }

    const paint = (code: number, fill: string, glow: string | null) => {
      const path = paths.get(code);
      if (!path) {
        return;
      }
      // shadowBlur ignores the transform, so it is scaled to device pixels by hand.
      ctx.shadowBlur = glow ? 3 * dpr : 0;
      ctx.shadowColor = glow ?? 'transparent';
      ctx.fillStyle = fill;
      ctx.fill(path);
    };
    paint(DOT.off, rgba(0.07), null);
    paint(DOT.rule, rgba(0.35), null);
    paint(DOT.dim, rgba(0.5), rgba(0.35));
    paint(DOT.lit, rgba(1), rgba(0.75));
    paint(DOT.white, '#ffffff', 'rgba(255, 255, 255, 0.7)');
  }
}
