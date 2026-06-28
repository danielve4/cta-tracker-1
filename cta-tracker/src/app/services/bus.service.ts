import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BustimeResponse } from '../busResponse';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class BusService {
  private readonly baseURL = environment.baseURL;
  private readonly routesPath = 'busroutes';
  private readonly routesURL = `${this.baseURL}/${this.routesPath}`;
  private readonly routeDirectionsPath = 'busroutedirections';
  private readonly routeStopsPath = 'busroutestops';
  private readonly arrivalsURL = `${this.baseURL}/busstoparrivals`;
  private readonly followURL = `${this.baseURL}/busfollow`;

  constructor(private http: HttpClient) {}

  routes(getCached = true): Observable<BustimeResponse> {
    return (getCached && this.getCached(this.routesPath)) ||
      this.http.get<BustimeResponse>(this.routesURL).pipe(tap((response: BustimeResponse) => {
        if (!response.error) {
          localStorage.setItem(this.routesPath, JSON.stringify(response));
        }
      }));
  }

  directions(route: string, getCached = true): Observable<BustimeResponse> {
    const path = `${this.routeDirectionsPath}?route=${route}`;
    return (getCached && this.getCached(path)) ||
      this.http.get<BustimeResponse>(`${this.baseURL}/${path}`).pipe(tap((response: BustimeResponse) => {
        if (!response.error) {
          localStorage.setItem(path, JSON.stringify(response));
        }
      }));
  }

  stops(route: string, direction: string, getCached = true): Observable<BustimeResponse> {
    const path = `${this.routeStopsPath}?route=${route}&direction=${direction}`;
    return (getCached && this.getCached(path)) ||
      this.http.get<BustimeResponse>(`${this.baseURL}/${path}`).pipe(tap((response: BustimeResponse) => {
        if (!response.error) {
          localStorage.setItem(path, JSON.stringify(response));
        }
      }));
  }

  arrivalsUrl(stopId: number): string {
    return `${this.arrivalsURL}?stopId=${stopId}`;
  }

  followUrl(vehicleId: number): string {
    return `${this.followURL}?vehicleId=${vehicleId}`;
  }

  private getCached(item: string): Observable<BustimeResponse> | null {
    const cachedResult = localStorage.getItem(item);
    if (cachedResult) {
      try {
        return of(JSON.parse(cachedResult) as BustimeResponse);
      } catch {
        console.log('Unable to cast and return cached ' + item);
      }
    }
    return null;
  }
}
