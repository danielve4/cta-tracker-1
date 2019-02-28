import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

interface Favorite {
  route: string,
  stopId: number,
  stopName: string,
  direction: string
}

@Injectable({
  providedIn: 'root'
})
export class FavoritesService {

  readonly localStorageKey: string = 'favorites';

  favorites: [Favorite];

  constructor() { }

  getFavorites(): Observable<Favorite[]> {
    const cachedFavorites = localStorage.getItem(this.localStorageKey);
    if (cachedFavorites) {
      try {
        return of(<Favorite[]>JSON.parse(cachedFavorites));
      } catch (e) {
        console.log("Unable to cast favorites");
      }
    }
    return of([]);
  }

  addToFavorites(stop: Favorite): void {
    const cachedFavorites = this.getFavorites();
    cachedFavorites.subscribe((favorites: Favorite[]) => {
      if(favorites.length === 0) {
        console.log("No current favorites!");
      }
    });
  }
}
