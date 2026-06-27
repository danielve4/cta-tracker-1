import { Component, OnInit, ChangeDetectionStrategy, signal, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BusService } from '../services/bus.service';
import { BustimeResponse, Stop, Error } from '../busResponse';
import { switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-stops',
  templateUrl: './stops.component.html',
  styleUrls: ['./stops.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink]
})
export class StopsComponent implements OnInit {
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly busService = inject(BusService);
  private readonly destroyRef = inject(DestroyRef);

  forRoute = signal('');
  forDirection = signal('');
  stops = signal<Stop[] | null>(null);
  private allStops: Stop[] = [];
  error = signal<Error[] | null>(null);

  ngOnInit(): void {
    this.activatedRoute.paramMap.pipe(
      switchMap(params => {
        this.forRoute.set(params.get('route') ?? '');
        this.forDirection.set(params.get('direction') ?? '');
        return this.busService.stops(this.forRoute(), this.forDirection());
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((response: BustimeResponse) => {
      if (response.error) {
        this.error.set(response.error);
      } else if (response.stops) {
        this.stops.set(response.stops);
        this.allStops = response.stops;
      }
    });
  }

  search(criteria: string): void {
    criteria = (criteria ? criteria.trim() : '').toLowerCase();
    this.stops.set(this.allStops.filter(stop => stop.stpnm.toLowerCase().includes(criteria)));
  }

  replaceSlash(value: string): string {
    return value.replace(/\//g, '-');
  }
}
