import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, inject, signal
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { placeName } from '../arrival-visuals';
import { ColumnVariantBase } from '../columns/column-variant.base';
import { ArrivalGroup } from '../train-arrival-groups';
import { DepthMarker, depthMarkers, stackBillboards } from './depth-geometry';
import { DepthListComponent } from './depth-list.component';

interface NeonTrain extends DepthMarker {
  group: ArrivalGroup;
  /** Across the stage, 0–100. */
  x: number;
  /** How high its billboard stands, so billboards of bunched far trains do not overlap. */
  lane: number;
}

/* Mirrors of the stage's --P, --D, --oy and the eye-to-floor distance (--H − --oy), so signs can
   be laid out where they actually land on screen. Change them with the CSS. */
const EYE_PX = 520;
const GRID_DEPTH_PX = 1600;
const EYE_FROM_TOP_PX = 75;
const EYE_ABOVE_FLOOR_PX = 265;
/** The stage's width before it has been measured: the most common phone's, less the page gutters. */
const DEFAULT_STAGE_WIDTH = 358;

/** A billboard's depth in px and its counter-scale, as in the CSS. */
const depthPx = (fraction: number) => 30 + fraction * (GRID_DEPTH_PX - 260);
const counterScale = (fraction: number) => 1 + fraction * 1.8;

/**
 * Synthwave: a neon grid running out to the Chicago skyline under a striped sun, and each train a
 * light streak racing in along its direction's lane, pushed back by how far away it is on the same
 * square-root scale as the Tunnel. Its minutes stand over it on a glowing billboard, scaled back up
 * against the perspective so a far one is still a number.
 *
 * The sky and skyline are flat, placed at the horizon the floor's far edge projects to (computed in
 * CSS from the same perspective and depth), so they cost no 3D at all. Only the floor, the streaks
 * on it and the billboards are in the scene. Stays dark in both themes: neon needs the night.
 */
@Component({
  selector: 'app-neon-skyline',
  templateUrl: './neon-skyline.component.html',
  styleUrls: ['../columns/columns-shared.css', './neon-skyline.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DepthListComponent]
})
export class NeonSkylineComponent extends ColumnVariantBase {
  readonly placeName = placeName;
  private readonly stageWidth = signal(DEFAULT_STAGE_WIDTH);

  constructor() {
    super();
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    // Browser-only: ResizeObserver does not exist during prerendering.
    afterNextRender(() => {
      const observer = new ResizeObserver(([entry]) => this.stageWidth.set(entry.contentRect.width));
      observer.observe(host);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  /** Each direction's lane across the stage, 0–100. */
  readonly lanes = computed(() => {
    const groups = (this.groups() ?? []).slice(0, 2);
    return groups.map((group, index) => ({ group, x: groups.length === 1 ? 50 : index === 0 ? 30 : 70 }));
  });

  readonly trains = computed<NeonTrain[]>(() => {
    const placed = this.lanes().flatMap(({ group, x }) =>
      depthMarkers(group.arrivals).map(marker => ({ ...marker, group, x })));
    const width = this.stageWidth();
    const lanes = stackBillboards(placed.map(train => {
      const perspective = EYE_PX / (EYE_PX + depthPx(train.fraction));
      const label = train.minutes === 0 ? 'Due' : `${train.minutes}min`;
      return {
        x: width / 2 + (train.x / 100 * width - width / 2) * perspective,
        y: EYE_FROM_TOP_PX + EYE_ABOVE_FLOOR_PX * perspective,
        scale: perspective * counterScale(train.fraction),
        width: label.length * 10 + 24
      };
    }));
    return placed
      .map((train, i) => ({ ...train, lane: lanes[i] }))
      // Furthest first, so a nearer billboard is later in the DOM and wins any tie in paint order.
      .sort((a, b) => b.fraction - a.fraction);
  });
}
