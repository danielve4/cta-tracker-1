import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import { BusService } from '../services/bus.service';
import { BustimeResponse, Direction, Error } from '../busResponse';
import { of, Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-directions',
  templateUrl: './directions.component.html',
  styleUrls: ['./directions.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [RouterLink, AsyncPipe]
})
export class DirectionsComponent implements OnInit {
  forRoute = '';
  directions$: Observable<Direction[]> | undefined;
  error$: Observable<Error[]> | undefined;

  constructor(
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private busService: BusService
  ) {}

  ngOnInit(): void {
    this.activatedRoute.paramMap.pipe(switchMap(params => {
      this.forRoute = params.get('route') ?? '';
      return this.busService.directions(this.forRoute);
    })).subscribe((response: BustimeResponse) => {
      if (response.error) {
        this.error$ = of(response.error);
      } else if (response.directions) {
        this.directions$ = of(response.directions);
      }
    });
  }
}
