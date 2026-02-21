import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import { TrainService } from '../services/train.service';
import { CTAComprehensiveData, CTALine, TRAIN_ROUTE_ID_TO_LINE_NAME } from '../trainResponse';
import { of, Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';

interface TrainStop {
  id: string;
  name: string;
}

@Component({
  selector: 'app-train-stops',
  templateUrl: './train-stops.component.html',
  styleUrls: ['./train-stops.component.css'],
  imports: [RouterLink, AsyncPipe]
})
export class TrainStopsComponent implements OnInit {
  routeId = '';
  line: CTALine | undefined;
  stops$: Observable<TrainStop[]> | undefined;
  private allStops: TrainStop[] = [];

  constructor(
    private activatedRoute: ActivatedRoute,
    private trainService: TrainService
  ) {}

  ngOnInit(): void {
    this.activatedRoute.paramMap.pipe(switchMap(params => {
      this.routeId = params.get('routeId') ?? '';
      return this.trainService.getComprehensiveData();
    })).subscribe((data: CTAComprehensiveData) => {
      this.line = data.lines.find(l => l.route_id === this.routeId);
      const lineName = TRAIN_ROUTE_ID_TO_LINE_NAME[this.routeId];
      const sequence = data.stopSequences[lineName];
      if (sequence) {
        this.allStops = sequence.stops
          .filter(id => data.stations[id])
          .map(id => ({ id, name: data.stations[id].name }));
        this.stops$ = of(this.allStops);
      }
    });
  }

  replaceSlash(value: string): string {
    return value.replace(/\//g, '-');
  }

  search(criteria: string): void {
    criteria = (criteria ? criteria.trim() : '').toLowerCase();
    this.stops$ = of(this.allStops.filter(stop => stop.name.toLowerCase().includes(criteria)));
  }
}
