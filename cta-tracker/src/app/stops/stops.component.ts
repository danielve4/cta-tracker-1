import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import { BusService } from '../services/bus.service';
import { BustimeResponse, Stop, Error } from '../busResponse';
import { of, Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-stops',
  templateUrl: './stops.component.html',
  styleUrls: ['./stops.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [RouterLink, AsyncPipe]
})
export class StopsComponent implements OnInit {
  forRoute = '';
  forDirection = '';
  stops$: Observable<Stop[]> | undefined;
  private allStops: Stop[] = [];
  error$: Observable<Error[]> | undefined;

  constructor(
    private activatedRoute: ActivatedRoute,
    private busService: BusService
  ) {}

  ngOnInit(): void {
    this.activatedRoute.paramMap.pipe(switchMap(params => {
      this.forRoute = params.get('route') ?? '';
      this.forDirection = params.get('direction') ?? '';
      return this.busService.stops(this.forRoute, this.forDirection);
    })).subscribe((response: BustimeResponse) => {
      if (response.error) {
        this.error$ = of(response.error);
      } else if (response.stops) {
        this.stops$ = of(response.stops);
        this.allStops = response.stops;
      }
    });
  }

  search(criteria: string): void {
    criteria = (criteria ? criteria.trim() : '').toLowerCase();
    this.stops$ = of(this.allStops.filter(stop => stop.stpnm.toLowerCase().includes(criteria)));
  }

  replaceSlash(value: string): string {
    return value.replace(/\//g, '-');
  }
}
