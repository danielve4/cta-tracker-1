import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import { BusService } from '../services/bus.service';
import { TrainService } from '../services/train.service';
import { BustimeResponse, Route, Error } from '../busResponse';
import { CTALine } from '../trainResponse';
import { of, Observable } from 'rxjs';

@Component({
  selector: 'app-routes',
  templateUrl: './routes.component.html',
  styleUrls: ['./routes.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [RouterLink, AsyncPipe]
})
export class RoutesComponent implements OnInit {
  routes$: Observable<Route[]> | undefined;
  private allRoutes: Route[] = [];
  error$: Observable<Error[]> | undefined;
  trainLines$: Observable<CTALine[]> | undefined;

  constructor(
    private busService: BusService,
    private trainService: TrainService
  ) {}

  ngOnInit(): void {
    this.trainService.getComprehensiveData().subscribe(data => {
      if (data.lines) {
        this.trainLines$ = of(data.lines);
      }
    });

    this.busService.routes().subscribe((response: BustimeResponse) => {
      if (response.error) {
        this.error$ = of(response.error);
      } else if (response.routes) {
        this.routes$ = of(response.routes);
        this.allRoutes = response.routes;
      }
    });
  }

  search(criteria: string): void {
    criteria = (criteria ? criteria.trim() : '').toLowerCase();
    this.routes$ = of(this.allRoutes.filter(route =>
      route.rtnm.toLowerCase().includes(criteria) || route.rt.includes(criteria)
    ));
  }
}
