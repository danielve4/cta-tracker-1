import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CTAComprehensiveData, TrainApiResponse } from '../trainResponse';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class TrainService {
  private readonly baseURL = environment.baseURL;
  private readonly trainDataPath = 'traindata';
  private readonly trainDataURL = `${this.baseURL}/${this.trainDataPath}`;
  private readonly arrivalsURL = `${this.baseURL}/trainstoparrivals`;
  private readonly followURL = `${this.baseURL}/trainfollow`;

  constructor(private http: HttpClient) {}

  getComprehensiveData(getCached = true): Observable<CTAComprehensiveData> {
    return (getCached && this.getCached(this.trainDataPath)) ||
      this.http.get<CTAComprehensiveData>(this.trainDataURL).pipe(tap((response: CTAComprehensiveData) => {
        if (response.lines) {
          localStorage.setItem(this.trainDataPath, JSON.stringify(response));
        }
      }));
  }

  arrivals(mapId: string): Observable<TrainApiResponse> {
    return this.http.get<TrainApiResponse>(`${this.arrivalsURL}?stopId=${mapId}`);
  }

  follow(runNumber: string): Observable<TrainApiResponse> {
    return this.http.get<TrainApiResponse>(`${this.followURL}?vehicleId=${runNumber}`);
  }

  private getCached(item: string): Observable<CTAComprehensiveData> | null {
    const cachedResult = localStorage.getItem(item);
    if (cachedResult) {
      try {
        return of(JSON.parse(cachedResult) as CTAComprehensiveData);
      } catch {
        console.log('Unable to cast and return cached ' + item);
      }
    }
    return null;
  }
}
