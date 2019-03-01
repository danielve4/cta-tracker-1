import { Component, OnInit, Input, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { BusService } from '../services/bus.service';
import { BustimeResponse, Prd, Error } from '../busResponse';
import { of, Observable, timer, Subscription } from 'rxjs';
import { FavoritesService } from '../services/favorites.service';
import { Favorite } from '../services/Favorite';

@Component({
  selector: 'app-arrivals',
  templateUrl: './arrivals.component.html',
  styleUrls: ['./arrivals.component.css']
})
export class ArrivalsComponent implements OnInit {

  forRoute: string;
  forDirection: string;
  forStopId: number;
  forStopName: string;
  @Input() vehicles$: Observable<Prd[]>;
  error$: Observable<Error[]>;
  refreshInterval: number;
  loading: boolean;
  timerRef: Subscription;

  constructor(private activatedRoute: ActivatedRoute,
    private busService: BusService, private favoritesService: FavoritesService) {
    this.refreshInterval = 30 * 1000; // In seconds
    this.loading = true;
  }

  ngOnInit() {
    const offlineTesting = false;
    this.activatedRoute.params.subscribe(params => {
      this.forRoute = params.route;
      this.forDirection = params.direction;
      this.forStopId = +params.stopId;
      this.forStopName = params.stopName;
      const fav: Favorite = {
        route: this.forRoute,
        stopId: this.forStopId,
        stopName: this.forStopName,
        direction: this.forDirection
      };
      this.favoritesService.addToFavorites(fav).subscribe().unsubscribe();
      this.timerRef = timer(0, this.refreshInterval).subscribe(() => {
        let arrivals;
        if (offlineTesting) arrivals = this.sampleArrivalsResponse();
        else arrivals = this.busService.arrivals(this.forStopId);

        arrivals.subscribe((response: BustimeResponse) => {
          this.handleArrivalsResponse(response);
        });
      });
    });
  }

  ngOnDestroy() {
    this.timerRef.unsubscribe();
  }

  handleArrivalsResponse(response: BustimeResponse): void {
    if (response.error) {
      this.error$ = of(response.error);
    } else {

      for (let i = 0; i < response.prd.length; i++) {
        if (response.prd[i].dly) {
          response.prd[i].prdctdn = this.getMinutesDifference(
            response.prd[i].tmstmp,
            response.prd[i].prdtm);
        }
      }
      this.loading = true;
      this.vehicles$ = of(response.prd);
      setTimeout(() => this.loading = false, 1000);
    }
  }


  getMinutesDifference(now: string, future: string): string {
    try {
      const minutes: string = (((this.getDate(future).getTime() - this.getDate(now).getTime()) / 1000) / 60).toFixed(0);
      return +minutes > 1 ? minutes : 'DUE';
    } catch (e) {
      return 'DLY';
    }
  }

  getDate(date: string): Date {
    const dateTime: string[] = date.split(' ');
    return new Date(
      +dateTime[0].slice(0, 4), // Year
      +dateTime[0].slice(4, 6) - 1, // Month - January is month 0
      +dateTime[0].slice(6, 8), // Day
      +dateTime[1].slice(0, 2), // Hour
      +dateTime[1].slice(3, 5) // Minutes
    );
  }

  sampleArrivalsResponse(): Observable<BustimeResponse> {
    const response = '{"prd":[{"tmstmp":"20190216 14:26","typ":"A","stpnm":"North Avenue + Lawndale","stpid":"881","vid":"8203","dstp":1920,"rt":"72","rtdd":"72","rtdir":"Eastbound","des":"Clark","prdtm":"20190216 14:28","tablockid":"72 -801","tatripid":"1017023","dly":false,"prdctdn":"DUE","zone":""},{"tmstmp":"20190216 14:26","typ":"A","stpnm":"North Avenue + Lawndale","stpid":"881","vid":"8127","dstp":4785,"rt":"72","rtdd":"72","rtdir":"Eastbound","des":"Clark","prdtm":"20190216 14:33","tablockid":"72 -810","tatripid":"1017024","dly":false,"prdctdn":"6","zone":""},{"tmstmp":"20190216 14:26","typ":"A","stpnm":"North Avenue + Lawndale","stpid":"881","vid":"8152","dstp":13369,"rt":"72","rtdd":"72","rtdir":"Eastbound","des":"Clark","prdtm":"20190216 14:44","tablockid":"72 -814","tatripid":"1017025","dly":false,"prdctdn":"17","zone":""},{"tmstmp":"20190216 14:26","typ":"A","stpnm":"North Avenue + Lawndale","stpid":"881","vid":"8196","dstp":23904,"rt":"72","rtdd":"72","rtdir":"Eastbound","des":"Clark","prdtm":"20190216 14:55","tablockid":"72 -807","tatripid":"1017026","dly":true,"prdctdn":"DLY","zone":""}]}';
    return of(<BustimeResponse>JSON.parse(response));
  }

}
