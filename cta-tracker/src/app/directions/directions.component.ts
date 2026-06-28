import { Component, ChangeDetectionStrategy, computed, inject } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BusService } from '../services/bus.service';
import { Direction, Error } from '../busResponse';

@Component({
  selector: 'app-directions',
  templateUrl: './directions.component.html',
  styleUrls: ['./directions.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink]
})
export class DirectionsComponent {
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly busService = inject(BusService);

  private readonly params = toSignal(this.activatedRoute.paramMap,
    { initialValue: this.activatedRoute.snapshot.paramMap });
  forRoute = computed(() => this.params().get('route') ?? '');

  private readonly directionsResource = rxResource({
    params: () => {
      const route = this.forRoute();
      return route ? { route } : undefined;
    },
    stream: ({ params }) => this.busService.directions(params.route)
  });

  directions = computed<Direction[] | null>(() =>
    this.directionsResource.hasValue() ? this.directionsResource.value().directions ?? null : null);

  error = computed<Error[] | null>(() => {
    if (this.directionsResource.error()) {
      return [{ stpid: '', msg: 'Network error' }];
    }
    return (this.directionsResource.hasValue() ? this.directionsResource.value().error : null) ?? null;
  });
}
