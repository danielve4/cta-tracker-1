import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { placeName } from '../arrival-visuals';
import { ColumnVariantBase } from '../columns/column-variant.base';
import { ArrivalGroup } from '../train-arrival-groups';
import { DepthMarker, depthMarkers } from './depth-geometry';
import { DepthListComponent } from './depth-list.component';

interface TunnelTrack {
  group: ArrivalGroup;
  /** Across the floor, 0–100. */
  x: number;
  trains: DepthMarker[];
}

/**
 * Standing on an island platform in the subway, looking down the tunnel. Each direction has its own
 * track, and its trains stand on it as real boxes — a stainless front, sides and a roof running back
 * a car length — pushed into the tunnel by how far away they are, on the same square-root scale as
 * the Approach track. Perspective does the rest: a train 2 minutes out fills the track, one 25
 * minutes out is a pair of headlights by the vanishing point. Each train's minutes are lit on its
 * windshield; the eye is set high, so a later train shows over the roof of the one in front of it.
 *
 * Pure CSS 3D: one `perspective` on the stage, `preserve-3d` on the world, and every plane placed
 * with `rotateX`/`rotateY` and `translateZ`. The depth is a `--f` custom property per train, so a
 * refresh that moves a train from 6 to 4 minutes transitions it along the track, and
 * `@starting-style` rolls a newly predicted train in out of the dark.
 */
@Component({
  selector: 'app-tunnel',
  templateUrl: './tunnel.component.html',
  styleUrls: ['../columns/columns-shared.css', './tunnel.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DepthListComponent]
})
export class TunnelComponent extends ColumnVariantBase {
  readonly placeName = placeName;

  readonly tracks = computed<TunnelTrack[]>(() => {
    const groups = (this.groups() ?? []).slice(0, 2);
    return groups.map((group, index) => {
      return {
        group,
        x: groups.length === 1 ? 50 : index === 0 ? 25 : 75,
        // Furthest first, so the nearer train is later in the DOM and wins any tie in paint order.
        trains: depthMarkers(group.arrivals).reverse()
      };
    });
  });
}
