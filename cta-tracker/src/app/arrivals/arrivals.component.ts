import { Component, OnInit, Input } from '@angular/core';
import { BusService } from '../services/bus.service';
import { Prd } from '../busResponse';
import { of, Observable, interval, timer } from 'rxjs';
import { map, tap, switchMap, startWith } from 'rxjs/operators';

@Component({
  selector: 'app-arrivals',
  templateUrl: './arrivals.component.html',
  styleUrls: ['./arrivals.component.css']
})
export class ArrivalsComponent implements OnInit {

  @Input() vehicles: Observable<Prd[]>;

  constructor(private busService: BusService) { }

  ngOnInit() {
    const stopId = 881;
    timer(0, 30000).pipe(
      switchMap(() => this.busService.arrivals(stopId))
    ).subscribe(result => {
      this.vehicles = of(result.prd);
    });
  }

}
