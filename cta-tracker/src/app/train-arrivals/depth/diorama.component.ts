import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, inject, signal, viewChild
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TRACK_STATION_PERCENT, assignLanes, minutesAway, placeName, trackPercent } from '../arrival-visuals';
import { ColumnVariantBase } from '../columns/column-variant.base';
import { ArrivalGroup, TrainArrivalDisplay } from '../train-arrival-groups';
import { BoxComponent } from './box.component';
import { DRAG_YAW_PER_PX, Orbit, REST_ORBIT, clampOrbit, tiltToOrbit } from './depth-geometry';
import { DepthListComponent } from './depth-list.component';

interface ModelTrain {
  arrival: TrainArrivalDisplay;
  group: ArrivalGroup;
  /** Along the structure, 0–100, on the Approach track's scale. */
  percent: number;
  /** 0: the far track, trains from the left. 1: the near track, trains from the right. */
  track: number;
  /** Raises the label's stem so labels of neighbouring trains do not overlap. */
  lane: number;
}

/** Evenly along the structure, clear of both ends. */
const PILLARS = [6, 18, 30, 42, 58, 70, 82, 94];

/** The same few buildings at every station: a model, not a map. [left %, top %, w, d, h] */
const BUILDINGS: ReadonlyArray<readonly [number, number, number, number, number]> = [
  [4, 6, 34, 26, 30], [22, 8, 26, 22, 52], [68, 4, 40, 28, 22], [86, 10, 26, 24, 40],
  [8, 74, 30, 22, 18], [36, 78, 38, 18, 26], [72, 76, 28, 20, 44]
];

type OrientationEventWithPermission = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

/**
 * A tabletop model of an elevated L station: the structure on its pillars, a station with side
 * platforms and canopies in the line colour, and each direction's trains on their own track —
 * the far track's from the left, the near track's from the right, the way two tracks really pass
 * a station. Positions are the Approach track's, so a rider who knows one reads the other.
 *
 * The camera is two `@property`-registered angles, so the labels, which counter-rotate to face
 * you, stay in step with the model while it eases. Drag across it to turn it; the Tilt chip hands
 * the camera to the gyroscope, behind iOS's motion-permission prompt, which only a tap may raise.
 */
@Component({
  selector: 'app-diorama',
  templateUrl: './diorama.component.html',
  styleUrls: ['../columns/columns-shared.css', './diorama.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, BoxComponent, DepthListComponent]
})
export class DioramaComponent extends ColumnVariantBase {
  readonly pillars = PILLARS;
  readonly buildings = BUILDINGS;
  readonly placeName = placeName;

  readonly orbit = signal<Orbit>(REST_ORBIT);
  readonly dragging = signal(false);
  readonly tilting = signal(false);
  /** Shown only on touch devices that have the API; the permission is asked for on tap. */
  readonly canTilt = signal(false);

  private readonly scene = viewChild<ElementRef<HTMLElement>>('scene');
  private drag: { pointerId: number; startX: number; startYaw: number; moved: boolean } | null = null;
  private tiltBaseline: { beta: number; gamma: number } | null = null;
  private readonly onOrientation = (event: DeviceOrientationEvent) => {
    if (event.beta === null || event.gamma === null) {
      return;
    }
    const reading = { beta: event.beta, gamma: event.gamma };
    this.tiltBaseline ??= reading;
    this.orbit.set(tiltToOrbit(reading, this.tiltBaseline));
  };

  constructor() {
    super();
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      // Desktop browsers have the API too, but no gyroscope to feed it.
      this.canTilt.set(typeof DeviceOrientationEvent !== 'undefined' && matchMedia('(pointer: coarse)').matches);
      // A drag must not also follow the train it ended on. Capture phase, so it runs before the
      // RouterLink's own click handler on the train.
      const scene = this.scene()?.nativeElement;
      const swallow = (event: MouseEvent) => {
        if (this.drag?.moved) {
          event.preventDefault();
          event.stopPropagation();
        }
        this.drag = null;
      };
      scene?.addEventListener('click', swallow, true);
      destroyRef.onDestroy(() => {
        scene?.removeEventListener('click', swallow, true);
        window.removeEventListener('deviceorientation', this.onOrientation);
      });
    });
  }

  readonly station = computed(() =>
    (this.groups()?.length ?? 0) === 1 ? TRACK_STATION_PERCENT.single : TRACK_STATION_PERCENT.double);

  readonly trains = computed<ModelTrain[]>(() => {
    const groups = (this.groups() ?? []).slice(0, 2);
    const single = groups.length === 1;
    const placed: Omit<ModelTrain, 'lane'>[] = [];
    groups.forEach((group, track) => {
      for (const arrival of group.arrivals) {
        const minutes = minutesAway(arrival.countdown);
        if (minutes !== null) {
          placed.push({ arrival, group, track, percent: trackPercent(minutes, single ? 'single' : track === 0 ? 'left' : 'right') });
        }
      }
    });
    // Label widths as a share of a ~340px model; errs wide, like the Approach pills.
    const lanes = assignLanes(placed.map(train => ({
      percent: train.percent,
      widthPercent: (this.label(train.arrival).length * 9 + 20) / 340 * 100
    })), [], 3);
    return placed.map((train, i) => ({ ...train, lane: lanes[i] }));
  });

  label(arrival: TrainArrivalDisplay): string {
    return arrival.countdown === 'DUE' ? 'Due' : `${arrival.countdown}m`;
  }

  onPointerDown(event: PointerEvent): void {
    if (this.tilting() || (event.pointerType === 'mouse' && event.button !== 0)) {
      return;
    }
    this.drag = { pointerId: event.pointerId, startX: event.clientX, startYaw: this.orbit().yaw, moved: false };
  }

  onPointerMove(event: PointerEvent): void {
    const drag = this.drag;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    const dx = event.clientX - drag.startX;
    if (!drag.moved && Math.abs(dx) > 6) {
      drag.moved = true;
      this.dragging.set(true);
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    }
    if (drag.moved) {
      this.orbit.update(orbit => clampOrbit({ ...orbit, yaw: drag.startYaw + dx * DRAG_YAW_PER_PX }));
    }
  }

  onPointerUp(): void {
    this.dragging.set(false);
    // Left for the click that follows, which checks `moved`; a pointerup with no click clears it
    // on the next pointerdown.
    if (this.drag && !this.drag.moved) {
      this.drag = null;
    }
  }

  async toggleTilt(): Promise<void> {
    if (this.tilting()) {
      window.removeEventListener('deviceorientation', this.onOrientation);
      this.tilting.set(false);
      this.orbit.set(REST_ORBIT);
      return;
    }
    const api = DeviceOrientationEvent as OrientationEventWithPermission;
    try {
      // iOS asks once per origin, and only from a tap; everywhere else there is nothing to ask.
      if (typeof api.requestPermission === 'function' && await api.requestPermission() !== 'granted') {
        return;
      }
    } catch {
      return;
    }
    this.tiltBaseline = null;
    window.addEventListener('deviceorientation', this.onOrientation);
    this.tilting.set(true);
  }
}
