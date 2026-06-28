import { Component, OnInit, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BusService } from '../services/bus.service';
import { TrainService } from '../services/train.service';
import { BustimeResponse, Route, Error } from '../busResponse';
import { CTALine } from '../trainResponse';

@Component({
  selector: 'app-routes',
  templateUrl: './routes.component.html',
  styleUrls: ['./routes.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink]
})
export class RoutesComponent implements OnInit {
  private readonly busService = inject(BusService);
  private readonly trainService = inject(TrainService);

  readonly placeholderRows = [0, 1, 2, 3, 4, 5];
  routes = signal<Route[] | null>(null);
  private allRoutes: Route[] = [];
  error = signal<Error[] | null>(null);
  trainLines = signal<CTALine[] | null>(null);

  ngOnInit(): void {
    this.trainService.getComprehensiveData().subscribe(data => {
      if (data.lines) {
        this.trainLines.set(data.lines);
      }
    });

    this.busService.routes().subscribe((response: BustimeResponse) => {
      if (response.error) {
        this.error.set(response.error);
      } else if (response.routes) {
        this.routes.set(response.routes);
        this.allRoutes = response.routes;
      }
    });
  }

  search(criteria: string): void {
    criteria = (criteria ? criteria.trim() : '').toLowerCase();
    this.routes.set(this.allRoutes.filter(route =>
      route.rtnm.toLowerCase().includes(criteria) || route.rt.includes(criteria)
    ));
  }
}
