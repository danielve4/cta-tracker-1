import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { Favorite } from './Favorite';
import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class FavoritesService {

  readonly localStorageKey: string = 'favorites';

  favorites: Observable<Array<Favorite>>;

  baseURL: string = environment.baseURL;
  saveFavoritesURL: string;
  syncFavoritesURL: string;

  constructor(private http: HttpClient) {
    this.saveFavoritesURL = `${this.baseURL}/savefavorites`;
    this.syncFavoritesURL = `${this.baseURL}/myfavorites`;
  }

  getFavorites(): Observable<Array<Favorite>> {
    if (this.favorites) return this.favorites;
    const cachedFavorites = localStorage.getItem(this.localStorageKey);
    if (cachedFavorites) {
      try {
        this.favorites = of(<Array<Favorite>>JSON.parse(cachedFavorites));
        return this.favorites;
      } catch (e) {
        console.log("Unable to cast favorites");
      }
    }
    return of([]);
  }

  addToFavorites(stop: Favorite): Observable<boolean> {
    const cachedFavorites = this.getFavorites();
    return this.search(stop).pipe(
      map((index: number) => {
        if (index < 0) {
          cachedFavorites.subscribe((favorites: Array<Favorite>) => {
            favorites[favorites.length] = stop;
            this.storeFavorites(favorites);
          });
          return true;
        } else {
          return false;
        }
      }));
  }

  removeFromFavorites(stop: Favorite): Observable<boolean> {
    const cachedFavorites = this.getFavorites();
    return this.search(stop).pipe(
      map((index: number) => {
        if (index >= 0) {
          cachedFavorites.subscribe((favorites: Array<Favorite>) => {
            favorites.splice(index, 1);
            this.storeFavorites(favorites);
          });
          return true;
        } else {
          return false;
        }
      }));
  }

  storeFavorites(favorites: Array<Favorite>): void {
    localStorage.setItem(this.localStorageKey, JSON.stringify(favorites));
    this.favorites = of(favorites);
  }

  search(stop: Favorite): Observable<number> {
    return this.getFavorites().pipe(
      map((favorites: Array<Favorite>) => {
        for (let i = 0; i < favorites.length; i++) {
          if (favorites[i].stopId === stop.stopId)
            return i;
        }
        return -1;
      })
    );
  }

  saveFavorites(phone: string, favorites: object): Observable<HttpResponse<string>> {
    const payload: object = {
      'id': phone,
      'favorites': favorites
    };
    return this.http.post(this.saveFavoritesURL, payload, { headers: new HttpHeaders({ 'Content-Type': 'application/json' }), responseType: 'text', observe: 'response' });
  }

  syncFavorites(phone: string): Observable<HttpResponse<string>> {
    const payload: object = {
      'id': phone
    };
    return this.http.post(this.syncFavoritesURL, payload, { headers: new HttpHeaders({ 'Content-Type': 'application/json' }), responseType: 'text', observe: 'response' }).pipe(tap((response: HttpResponse<string>) => {
      if(response.body) {
        try {
          const favoritesObject = JSON.parse(response.body);
          this.favorites = of(<Array<Favorite>>favoritesObject);
          this.storeFavorites(favoritesObject);
        } catch (e) {
          console.log("Unable to cast favorites");
        }
      }
    }));
  }
}
