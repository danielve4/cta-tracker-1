import { Component, ChangeDetectionStrategy, signal, computed, effect, inject } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TrainService } from '../services/train.service';
import { CTALine, TRAIN_ROUTE_ID_TO_LINE_NAME } from '../trainResponse';

interface TrainStop {
  id: string;
  name: string;
}

@Component({
  selector: 'app-train-stops',
  templateUrl: './train-stops.component.html',
  styleUrls: ['./train-stops.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink]
})
export class TrainStopsComponent {
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly trainService = inject(TrainService);

  private readonly params = toSignal(this.activatedRoute.paramMap,
    { initialValue: this.activatedRoute.snapshot.paramMap });
  routeId = computed(() => this.params().get('routeId') ?? '');
  searchTerm = signal('');

  private readonly dataResource = rxResource({
    params: () => {
      const routeId = this.routeId();
      return routeId ? routeId : undefined;
    },
    stream: () => this.trainService.getComprehensiveData()
  });

  line = computed<CTALine | undefined>(() => {
    const data = this.dataResource.hasValue() ? this.dataResource.value() : undefined;
    return data?.lines.find(l => l.route_id === this.routeId());
  });

  private readonly allStops = computed<TrainStop[]>(() => {
    const data = this.dataResource.hasValue() ? this.dataResource.value() : undefined;
    if (!data) {
      return [];
    }
    const lineName = TRAIN_ROUTE_ID_TO_LINE_NAME[this.routeId()];
    const sequence = data.stopSequences[lineName];
    if (!sequence) {
      return [];
    }
    return sequence.stops
      .filter(id => data.stations[id])
      .map(id => ({ id, name: data.stations[id].name }));
  });

  stops = computed<TrainStop[]>(() => {
    const criteria = this.searchTerm().trim().toLowerCase();
    const stops = this.allStops();
    return criteria ? stops.filter(stop => stop.name.toLowerCase().includes(criteria)) : stops;
  });

  errorMsg = computed<string | undefined>(() =>
    this.dataResource.error() ? 'Unable to load train data.' : undefined);

  constructor() {
    // Reset the search box's effect on the list when switching train lines.
    effect(() => {
      this.routeId();
      this.searchTerm.set('');
    });
  }

  replaceSlash(value: string): string {
    return value.replace(/\//g, '-');
  }

  search(criteria: string): void {
    this.searchTerm.set(criteria ?? '');
  }
}
