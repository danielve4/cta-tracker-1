import { Component, OnInit, Input } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { BusService } from '../services/bus.service';
import { BustimeResponse, Prd, Error } from '../busResponse';
import { of, Observable, timer } from 'rxjs';
import { switchMap } from 'rxjs/operators';

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

  constructor(private activatedRoute: ActivatedRoute,
    private busService: BusService) {
    this.refreshInterval = 30 * 1000; // In seconds
  }

  ngOnInit() {
    const offlineTesting = true;
    this.activatedRoute.paramMap.pipe(switchMap(params => {
      this.forRoute = params.get('route');
      this.forDirection = params.get('direction');
      this.forStopId = +params.get('stopId');
      this.forStopName = params.get('stopName');
      if (offlineTesting) {
        return this.sampleArrivalsResponse();
      } else {
        return this.busService.arrivals(this.forStopId);
      }
    })).subscribe((response: BustimeResponse) => {
      this.handleArrivalsResponse(response);
      timer(this.refreshInterval).pipe(
        switchMap(() => {
          if (offlineTesting) return this.sampleArrivalsResponse()
          else return this.busService.arrivals(this.forStopId)
        })
      ).subscribe(result => {
        this.handleArrivalsResponse(result);
      });
    });
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
      this.vehicles$ = of(response.prd);
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
