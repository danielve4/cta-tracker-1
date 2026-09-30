import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, inject, signal
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TimeuntilPipe } from '../../timeuntil.pipe';
import { TRAIN_ROUTE_ID_TO_LINE_NAME } from '../../trainResponse';
import { ColumnVariantBase } from '../columns/column-variant.base';
import { ArrivalGroup, TrainArrivalDisplay, splitNextUp } from '../train-arrival-groups';
import { CardTilt, HAND_MAX_CARDS, REST_TILT, cardTilt, fanLayout, tiltToCard } from './depth-geometry';
import { DeviceTilt, tiltAvailable } from './device-tilt';

interface HoloShelf {
  group: ArrivalGroup;
  hero: TrainArrivalDisplay | null;
  hand: Array<{ arrival: TrainArrivalDisplay; angle: number; lift: number }>;
  hidden: number;
}

/**
 * The next train on a holographic foil card, the way Dribbble shoots trading cards: it tips under
 * your finger and the rainbow foil and glare slide across it with the light. Later trains are a
 * fanned hand of smaller foil cards underneath.
 *
 * The tilt is four `@property`-registered values (`--rx`, `--ry`, `--gx`, `--gy`) derived from
 * inline `--tilt-*`, so a release springs back through a transition, and `@starting-style` can
 * swing the card in. The cards themselves are flat — no `preserve-3d` — which is what keeps the
 * foil's `mix-blend-mode` and the glare legal on them. The Tilt chip hands the light to the
 * gyroscope instead. Every card is a real link.
 */
@Component({
  selector: 'app-holo-card',
  templateUrl: './holo-card.component.html',
  styleUrls: ['../columns/columns-shared.css', './holo-card.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TimeuntilPipe]
})
export class HoloCardComponent extends ColumnVariantBase {
  /** The card being tipped by a finger, by group key; the gyroscope tips them all. */
  readonly active = signal<string | null>(null);
  readonly tilt = signal<CardTilt>(REST_TILT);
  readonly tilting = signal(false);
  readonly canTilt = signal(false);

  private press: { pointerId: number; x: number; y: number; moved: boolean } | null = null;
  private readonly deviceTilt = new DeviceTilt((reading, baseline) => this.tilt.set(tiltToCard(reading, baseline)));

  constructor() {
    super();
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.canTilt.set(tiltAvailable());
      // Tipping the card must not also follow its train. Capture phase, so it runs before the
      // RouterLink's own click handler.
      const swallow = (event: MouseEvent) => {
        if (this.press?.moved) {
          event.preventDefault();
          event.stopPropagation();
        }
        this.press = null;
      };
      host.addEventListener('click', swallow, true);
      destroyRef.onDestroy(() => {
        host.removeEventListener('click', swallow, true);
        this.deviceTilt.stop();
      });
    });
  }

  readonly shelves = computed<HoloShelf[]>(() =>
    (this.groups() ?? []).map(group => {
      const { hero, later } = splitNextUp(group);
      const shown = later.slice(0, HAND_MAX_CARDS);
      const fan = fanLayout(shown.length);
      return {
        group,
        hero,
        hand: shown.map((arrival, i) => ({ arrival, ...fan[i] })),
        hidden: later.length - shown.length
      };
    }));

  lineName(group: ArrivalGroup): string {
    const rt = group.arrivals[0]?.rt ?? '';
    return TRAIN_ROUTE_ID_TO_LINE_NAME[rt] ?? rt;
  }

  /** The tilt a card is drawn at: the gyroscope's for every card, a finger's for the one pressed. */
  tiltFor(key: string): CardTilt {
    return this.tilting() || this.active() === key ? this.tilt() : REST_TILT;
  }

  onPointerDown(key: string, event: PointerEvent): void {
    if (this.tilting()) {
      return;
    }
    this.press = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    this.follow(key, event);
  }

  onPointerMove(key: string, event: PointerEvent): void {
    if (this.tilting()) {
      return;
    }
    const press = this.press;
    // A mouse tips the card on hover; a finger only while it is down.
    if (!press && event.pointerType !== 'mouse') {
      return;
    }
    if (press && !press.moved && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 6) {
      press.moved = true;
    }
    this.follow(key, event);
  }

  onPointerEnd(): void {
    if (this.press && !this.press.moved) {
      this.press = null;
    }
    this.active.set(null);
    if (!this.tilting()) {
      this.tilt.set(REST_TILT);
    }
  }

  async toggleTilt(): Promise<void> {
    if (this.tilting()) {
      this.deviceTilt.stop();
      this.tilting.set(false);
      this.tilt.set(REST_TILT);
      return;
    }
    this.tilting.set(await this.deviceTilt.start());
  }

  /** Measured on the untransformed stage, not the tipped card, so the tilt cannot feed back on itself. */
  private follow(key: string, event: PointerEvent): void {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.active.set(key);
    this.tilt.set(cardTilt(event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height));
  }
}
