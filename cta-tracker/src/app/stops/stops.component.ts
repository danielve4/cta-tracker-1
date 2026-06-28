import { Component, ChangeDetectionStrategy, signal, computed, effect, inject } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BusService } from '../services/bus.service';
import { Stop, Error } from '../busResponse';

@Component({
  selector: 'app-stops',
  templateUrl: './stops.component.html',
  styleUrls: ['./stops.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink]
})
export class StopsComponent {
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly busService = inject(BusService);

  private readonly params = toSignal(this.activatedRoute.paramMap,
    { initialValue: this.activatedRoute.snapshot.paramMap });
  forRoute = computed(() => this.params().get('route') ?? '');
  forDirection = computed(() => this.params().get('direction') ?? '');
  searchTerm = signal('');

  private readonly stopsResource = rxResource({
    params: () => {
      const route = this.forRoute();
      const direction = this.forDirection();
      return route ? { route, direction } : undefined;
    },
    stream: ({ params }) => this.busService.stops(params.route, params.direction)
  });

  private readonly allStops = computed<Stop[]>(() =>
    this.stopsResource.hasValue() ? this.stopsResource.value().stops ?? [] : []);

  stops = computed<Stop[]>(() => {
    const criteria = this.searchTerm().trim().toLowerCase();
    const stops = this.allStops();
    return criteria ? stops.filter(stop => stop.stpnm.toLowerCase().includes(criteria)) : stops;
  });

  error = computed<Error[] | null>(() => {
    if (this.stopsResource.error()) {
      return [{ stpid: '', msg: 'Network error' }];
    }
    return (this.stopsResource.hasValue() ? this.stopsResource.value().error : null) ?? null;
  });

  constructor() {
    // Reset the search box's effect on the list when navigating to a new route/direction,
    // matching the old behavior of reloading the full list on new route data.
    effect(() => {
      this.forRoute();
      this.forDirection();
      this.searchTerm.set('');
    });
  }

  search(criteria: string): void {
    this.searchTerm.set(criteria ?? '');
  }

  replaceSlash(value: string): string {
    return value.replace(/\//g, '-');
  }
}
