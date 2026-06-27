import { Component, OnInit, ChangeDetectionStrategy, signal, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BusService } from '../services/bus.service';
import { BustimeResponse, Direction, Error } from '../busResponse';
import { switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-directions',
  templateUrl: './directions.component.html',
  styleUrls: ['./directions.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink]
})
export class DirectionsComponent implements OnInit {
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly busService = inject(BusService);
  private readonly destroyRef = inject(DestroyRef);

  forRoute = signal('');
  directions = signal<Direction[] | null>(null);
  error = signal<Error[] | null>(null);

  ngOnInit(): void {
    this.activatedRoute.paramMap.pipe(
      switchMap(params => {
        this.forRoute.set(params.get('route') ?? '');
        return this.busService.directions(this.forRoute());
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((response: BustimeResponse) => {
      if (response.error) {
        this.error.set(response.error);
      } else if (response.directions) {
        this.directions.set(response.directions);
      }
    });
  }
}
