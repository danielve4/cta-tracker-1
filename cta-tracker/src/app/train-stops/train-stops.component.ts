import { Component, OnInit, ChangeDetectionStrategy, signal, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TrainService } from '../services/train.service';
import { CTAComprehensiveData, CTALine, TRAIN_ROUTE_ID_TO_LINE_NAME } from '../trainResponse';
import { switchMap } from 'rxjs/operators';

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
export class TrainStopsComponent implements OnInit {
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly trainService = inject(TrainService);
  private readonly destroyRef = inject(DestroyRef);

  routeId = signal('');
  line = signal<CTALine | undefined>(undefined);
  stops = signal<TrainStop[] | null>(null);
  private allStops: TrainStop[] = [];

  ngOnInit(): void {
    this.activatedRoute.paramMap.pipe(
      switchMap(params => {
        this.routeId.set(params.get('routeId') ?? '');
        return this.trainService.getComprehensiveData();
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((data: CTAComprehensiveData) => {
      this.line.set(data.lines.find(l => l.route_id === this.routeId()));
      const lineName = TRAIN_ROUTE_ID_TO_LINE_NAME[this.routeId()];
      const sequence = data.stopSequences[lineName];
      if (sequence) {
        this.allStops = sequence.stops
          .filter(id => data.stations[id])
          .map(id => ({ id, name: data.stations[id].name }));
        this.stops.set(this.allStops);
      }
    });
  }

  replaceSlash(value: string): string {
    return value.replace(/\//g, '-');
  }

  search(criteria: string): void {
    criteria = (criteria ? criteria.trim() : '').toLowerCase();
    this.stops.set(this.allStops.filter(stop => stop.name.toLowerCase().includes(criteria)));
  }
}
