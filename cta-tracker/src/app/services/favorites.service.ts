import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { Favorite } from './Favorite';

@Injectable({
  providedIn: 'root'
})
export class FavoritesService {

  readonly localStorageKey: string = 'favorites';

  favorites: Observable<Array<Favorite>>;

  constructor() { }

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
}
